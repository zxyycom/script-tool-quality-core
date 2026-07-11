/**
 * Baseline commit 定位与 materialization。
 *
 * 从 git history 定位 previous-code baseline commit，并在临时隔离目录中
 * 用当前配置和当前 wrapper/tool 扫描 baseline commit。
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { minimatch } from "minimatch";

import { gitGlobPathspecArgs } from "./git-pathspec.ts";
import {
  gitCommitDate,
  gitHeadSha,
  processFailed,
  runGit,
  runProcessSync,
  toSlashPath
} from "../../../foundation/src/index.ts";
import {
  collectRevisionChanges,
  collectWorkingTreeChanges,
  submoduleHistoryPaths,
  uniqueSortedPaths
} from "./revision-tree.ts";
import { materializeRevisionGitlinks } from "./revision-materialization.ts";

type BaselineCommitResult =
  | { date: string | null; ok: true; reason: string; sha: string }
  | { error: string; ok: false };

type MaterializeBaselineResult =
  | { ok: true; workDir: string }
  | { error: string; ok: false; reason: string };

type ChangeScope = {
  changed: boolean;
  changedFiles: string[];
};

/**
 * 定位 previous-code baseline commit。
 *
 * 规则：
 * 1. 先确定当前配置的 scan inputs（纳入扫描的 code inputs）
 * 2. 如果 current revision 修改了任何 scan input → baseline 是 current revision 之前的最近代码提交
 * 3. 如果 current revision 没修改 scan input → baseline 是最近代码提交
 */
export function locateBaselineCommit({
  cwd,
  scanInputPaths
}: {
  cwd: string;
  scanInputPaths: string[];
}): BaselineCommitResult {
  const headSha = gitHeadSha(cwd);
  if (!headSha) {
    return { ok: false, error: "git rev-parse HEAD failed: no git repository" };
  }

  if (!hasParentCommit(cwd, headSha)) {
    return { ok: false, error: "no-baseline-commit: repository has only one commit" };
  }

  const historyPaths = [
    ...scanInputPaths,
    ...submoduleHistoryPaths(cwd, headSha, scanInputPaths)
  ];
  const patternArgs = gitGlobPathspecArgs([...new Set(historyPaths)], { omitWhenEmpty: true });

  const headModifiedScanInputs = commitModifiesScanInputs({
    cwd,
    headSha,
    scanInputPaths
  });

  if (headModifiedScanInputs) {
    return baselineForChangedHead(cwd, headSha, patternArgs);
  }

  return baselineForUnchangedHead(cwd, headSha, patternArgs);
}

/**
 * 在隔离目录中生成 baseline snapshot。
 *
 * 通过 git archive 导出文件；导出的目录不是 git repo。
 */
export function materializeBaselineRevision({
  commitSha,
  cwd,
  baselineWorkDir
}: {
  baselineWorkDir: string;
  commitSha: string;
  cwd: string;
}): MaterializeBaselineResult {
  mkdirSync(baselineWorkDir, { recursive: true });

  const archivePath = join(baselineWorkDir, "baseline.tar");

  const archiveResult = runGit([
    "archive",
    "--format=tar",
    "--output", archivePath,
    commitSha
  ], {
    cwd
  });

  if (processFailed(archiveResult)) {
    return {
      ok: false,
      error: `git archive failed: ${archiveResult.error?.message || archiveResult.stderr || "exit " + archiveResult.status}`,
      reason: "baseline-materialization-failed"
    };
  }

  const untarDir = join(baselineWorkDir, "repo");
  mkdirSync(untarDir, { recursive: true });

  const untarResult = runProcessSync("tar", ["-xf", archivePath, "-C", untarDir], { cwd: baselineWorkDir });

  if (processFailed(untarResult)) {
    return {
      ok: false,
      error: `tar extract failed: ${untarResult.error?.message || untarResult.stderr || "exit " + untarResult.status}`,
      reason: "baseline-materialization-failed"
    };
  }

  const submoduleError = materializeRevisionGitlinks({
    archiveDir: baselineWorkDir,
    archiveIndex: { value: 0 },
    repository: cwd,
    revision: commitSha,
    targetDir: untarDir
  });
  if (submoduleError) {
    return {
      ok: false,
      error: submoduleError,
      reason: "baseline-materialization-failed"
    };
  }

  return { ok: true, workDir: untarDir };
}

export function detectScanInputChange({
  baselineSha,
  cwd,
  scanInputPaths
}: {
  baselineSha: string | null;
  cwd: string;
  scanInputPaths: string[];
}): ChangeScope {
  if (!baselineSha) {
    return { changed: true, changedFiles: [] };
  }

  const changedFiles = [
    ...getRevisionChangedFiles(cwd, baselineSha, "HEAD", scanInputPaths),
    ...getWorkingTreeChangedFiles(cwd, scanInputPaths)
  ].map(toSlashPath);
  const uniqueChangedFiles = uniqueSortedPaths(changedFiles);
  const scanInputChanged = changedFiles.some((f) =>
    scanInputPaths.some((p) => fileMatchesPattern(f, p))
  );

  return { changed: scanInputChanged, changedFiles: uniqueChangedFiles };
}

// ── Helpers ───────────────────────────────────────────────────────────

export function getWorkingTreeChangedFiles(cwd: string, scanInputPaths: string[]): string[] {
  return uniqueSortedPaths(collectWorkingTreeChanges({
    prefix: "",
    repository: cwd,
    revision: "HEAD",
    scanInputPaths
  }));
}

export function getRevisionChangedFiles(
  cwd: string,
  fromRevision: string,
  toRevision: string,
  scanInputPaths: string[] | readonly string[]
): string[] {
  return uniqueSortedPaths(collectRevisionChanges({
    fromRevision,
    prefix: "",
    repository: cwd,
    scanInputPaths,
    toRevision
  }));
}

function hasParentCommit(cwd: string, headSha: string): boolean {
  const parentCount = runGit(["rev-list", "--count", "--max-count=1", `${headSha}^`], { cwd });
  return parentCount.status === 0 && parseInt(parentCount.stdout.trim(), 10) > 0;
}

function baselineForChangedHead(cwd: string, headSha: string, patternArgs: string[]): BaselineCommitResult {
  const baselineSha = latestCodeCommitBeforeHead(cwd, headSha, patternArgs);
  if (baselineSha) {
    return baselineCommit(cwd, baselineSha, "previous-code-commit");
  }

  const parentBaseline = parentBaselineCommit(cwd, headSha, "parent-commit");
  if (parentBaseline) {
    return parentBaseline;
  }

  return { ok: false, error: "no-baseline-commit: no previous commit found" };
}

function baselineForUnchangedHead(cwd: string, headSha: string, patternArgs: string[]): BaselineCommitResult {
  const baselineSha = latestCodeCommit(cwd, patternArgs);
  if (baselineSha) {
    return baselineCommit(cwd, baselineSha, "nearest-code-commit");
  }

  const parentBaseline = parentBaselineCommit(cwd, headSha, "parent-commit-fallback");
  if (parentBaseline) {
    return parentBaseline;
  }

  return { ok: false, error: "no-baseline-commit: no previous code commit found" };
}

function commitModifiesScanInputs({
  cwd,
  headSha,
  scanInputPaths
}: {
  cwd: string;
  headSha: string;
  scanInputPaths: string[];
}): boolean {
  const parent = `${headSha}^`;
  return getRevisionChangedFiles(cwd, parent, headSha, scanInputPaths).length > 0;
}

function latestCodeCommitBeforeHead(cwd: string, headSha: string, patternArgs: string[]): string | null {
  return latestCommit(cwd, [
    "log",
    "--format=%H",
    "--max-count=1",
    "--skip=0",
    `${headSha}~1`,
    ...patternArgs
  ]);
}

function latestCodeCommit(cwd: string, patternArgs: string[]): string | null {
  return latestCommit(cwd, ["log", "--format=%H", "--max-count=1", ...patternArgs]);
}

function latestCommit(cwd: string, args: string[]): string | null {
  const logResult = runGit(args, { cwd });
  return trimStdout(logResult.stdout);
}

function parentBaselineCommit(cwd: string, headSha: string, reason: string): BaselineCommitResult | null {
  const parentResult = runGit(["rev-parse", `${headSha}~1`], { cwd });
  const parentSha = parentResult.status === 0 ? trimStdout(parentResult.stdout) : null;
  return parentSha ? baselineCommit(cwd, parentSha, reason) : null;
}

function baselineCommit(cwd: string, sha: string, reason: string): BaselineCommitResult {
  return {
    ok: true,
    sha,
    date: gitCommitDate(sha, cwd),
    reason
  };
}

function trimStdout(stdout: string | null | undefined): string | null {
  const value = (stdout || "").trim();
  return value || null;
}

function fileMatchesPattern(filePath: string, pattern: string): boolean {
  return minimatch(toSlashPath(filePath), pattern);
}
