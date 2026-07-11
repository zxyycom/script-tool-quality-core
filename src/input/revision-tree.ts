/** Submodule-aware Git tree traversal used by revision and working-tree scans. */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { minimatch } from "minimatch";

import {
  parseGitStatusPaths,
  processFailed,
  runGit,
  splitGitFileList,
  toSlashPath
} from "../../../foundation/src/index.ts";

export type Gitlink = {
  path: string;
  sha: string;
};

type RevisionChangeContext = {
  fromRevision: string;
  prefix: string;
  repository: string;
  scanInputPaths: string[] | readonly string[];
  toRevision: string;
};

export function collectRevisionChanges(context: RevisionChangeContext): string[] {
  const changed = directRevisionChanges(context);
  const before = gitlinkMap(gitlinksAtRevision(context.repository, context.fromRevision) ?? []);
  const after = gitlinkMap(gitlinksAtRevision(context.repository, context.toRevision) ?? []);

  for (const path of new Set([...before.keys(), ...after.keys()])) {
    changed.push(...changedGitlinkFiles({
      ...context,
      beforeSha: before.get(path),
      afterSha: after.get(path),
      path
    }));
  }

  return uniqueSortedPaths(changed);
}

export function collectWorkingTreeChanges({
  prefix,
  repository,
  revision,
  scanInputPaths
}: {
  prefix: string;
  repository: string;
  revision: string;
  scanInputPaths: string[];
}): string[] {
  const statusResult = runGit(["status", "--porcelain", "--untracked-files=all"], {
    cwd: repository,
    maxBuffer: 1024 * 1024 * 64
  });
  const changed = processFailed(statusResult)
    ? []
    : prefixAndFilter(parseGitStatusPaths(statusResult.stdout), prefix, scanInputPaths);

  for (const gitlink of gitlinksAtRevision(repository, revision) ?? []) {
    const submoduleRepository = resolve(repository, gitlink.path);
    if (!existsSync(submoduleRepository)) continue;

    const submodulePrefix = joinSlash(prefix, gitlink.path);
    const actualRevision = stdoutValue(runGit(["rev-parse", "HEAD"], {
      cwd: submoduleRepository
    }).stdout) ?? gitlink.sha;
    if (actualRevision !== gitlink.sha) {
      changed.push(...collectRevisionChanges({
        fromRevision: gitlink.sha,
        prefix: submodulePrefix,
        repository: submoduleRepository,
        scanInputPaths,
        toRevision: actualRevision
      }));
    }
    changed.push(...collectWorkingTreeChanges({
      prefix: submodulePrefix,
      repository: submoduleRepository,
      revision: actualRevision,
      scanInputPaths
    }));
  }

  return uniqueSortedPaths(changed);
}

export function collectSubmoduleWorktreeFiles(
  repository: string,
  scanInputPaths: string[] | readonly string[]
): string[] {
  const files: string[] = [];
  for (const gitlink of gitlinksAtRevision(repository, "HEAD") ?? []) {
    const submoduleRepository = resolve(repository, gitlink.path);
    if (!existsSync(submoduleRepository)) continue;
    files.push(...collectWorktreeFiles(
      submoduleRepository,
      gitlink.path,
      scanInputPaths
    ));
  }
  return uniqueSortedPaths(files);
}

export function submoduleHistoryPaths(
  cwd: string,
  headSha: string,
  scanInputPaths: string[]
): string[] {
  const candidates = [
    ...(gitlinksAtRevision(cwd, headSha) ?? []),
    ...(gitlinksAtRevision(cwd, `${headSha}^`) ?? [])
  ];
  const paths = new Set<string>();

  for (const gitlink of candidates) {
    const submoduleRepository = resolve(cwd, gitlink.path);
    if (!existsSync(submoduleRepository)) {
      paths.add(gitlink.path);
      continue;
    }
    const files = collectRevisionFiles(
      submoduleRepository,
      gitlink.sha,
      gitlink.path,
      scanInputPaths
    );
    if (files.length > 0) paths.add(gitlink.path);
  }

  return [...paths].sort();
}

export function uniqueSortedPaths(files: string[]): string[] {
  return [...new Set(files.map(toSlashPath))].sort();
}

function directRevisionChanges(context: RevisionChangeContext): string[] {
  const result = runGit([
    "diff",
    "--name-only",
    `${context.fromRevision}..${context.toRevision}`
  ], {
    cwd: context.repository,
    maxBuffer: 1024 * 1024 * 64
  });
  return processFailed(result)
    ? collectRevisionFiles(
      context.repository,
      context.toRevision,
      context.prefix,
      context.scanInputPaths
    )
    : prefixAndFilter(splitGitFileList(result.stdout), context.prefix, context.scanInputPaths);
}

function changedGitlinkFiles({
  afterSha,
  beforeSha,
  path,
  ...context
}: RevisionChangeContext & {
  afterSha: string | undefined;
  beforeSha: string | undefined;
  path: string;
}): string[] {
  if (beforeSha === afterSha) return [];

  const repository = resolve(context.repository, path);
  if (!existsSync(repository)) return [];

  const prefix = joinSlash(context.prefix, path);
  if (beforeSha && afterSha) {
    return collectRevisionChanges({
      ...context,
      fromRevision: beforeSha,
      prefix,
      repository,
      toRevision: afterSha
    });
  }

  const revision = afterSha ?? beforeSha;
  return revision
    ? collectRevisionFiles(repository, revision, prefix, context.scanInputPaths)
    : [];
}

function collectRevisionFiles(
  repository: string,
  revision: string,
  prefix: string,
  scanInputPaths: string[] | readonly string[]
): string[] {
  const treeResult = runGit(["ls-tree", "-r", "--name-only", revision], {
    cwd: repository,
    maxBuffer: 1024 * 1024 * 64
  });
  if (processFailed(treeResult)) return [];

  const files = prefixAndFilter(splitGitFileList(treeResult.stdout), prefix, scanInputPaths);
  for (const gitlink of gitlinksAtRevision(repository, revision) ?? []) {
    const submoduleRepository = resolve(repository, gitlink.path);
    if (!existsSync(submoduleRepository)) continue;
    files.push(...collectRevisionFiles(
      submoduleRepository,
      gitlink.sha,
      joinSlash(prefix, gitlink.path),
      scanInputPaths
    ));
  }
  return uniqueSortedPaths(files);
}

function collectWorktreeFiles(
  repository: string,
  prefix: string,
  scanInputPaths: string[] | readonly string[]
): string[] {
  const result = runGit(["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: repository,
    maxBuffer: 1024 * 1024 * 64
  });
  if (processFailed(result)) return [];

  const files = prefixAndFilter(splitGitFileList(result.stdout), prefix, scanInputPaths);
  const revision = stdoutValue(runGit(["rev-parse", "HEAD"], { cwd: repository }).stdout);
  if (!revision) return uniqueSortedPaths(files);

  for (const gitlink of gitlinksAtRevision(repository, revision) ?? []) {
    const submoduleRepository = resolve(repository, gitlink.path);
    if (!existsSync(submoduleRepository)) continue;
    files.push(...collectWorktreeFiles(
      submoduleRepository,
      joinSlash(prefix, gitlink.path),
      scanInputPaths
    ));
  }
  return uniqueSortedPaths(files);
}

export function gitlinksAtRevision(repository: string, revision: string): Gitlink[] | null {
  const result = runGit(["ls-tree", "-r", "-z", revision], {
    cwd: repository,
    maxBuffer: 1024 * 1024 * 64
  });
  if (processFailed(result)) return null;

  const gitlinks: Gitlink[] = [];
  for (const entry of result.stdout.split("\0")) {
    if (!entry) continue;
    const separator = entry.indexOf("\t");
    if (separator < 0) continue;
    const [mode, type, sha] = entry.slice(0, separator).split(/\s+/u);
    if (mode !== "160000" || type !== "commit" || !sha) continue;
    gitlinks.push({ path: toSlashPath(entry.slice(separator + 1)), sha });
  }
  return gitlinks;
}

function gitlinkMap(gitlinks: Gitlink[]): Map<string, string> {
  return new Map(gitlinks.map((gitlink) => [gitlink.path, gitlink.sha]));
}

function prefixAndFilter(
  files: string[],
  prefix: string,
  scanInputPaths: string[] | readonly string[]
): string[] {
  return files
    .map((file) => joinSlash(prefix, file))
    .filter((file) => scanInputPaths.length === 0 ||
      scanInputPaths.some((pattern) => minimatch(file, pattern)));
}

function joinSlash(prefix: string, path: string): string {
  return prefix ? `${toSlashPath(prefix)}/${toSlashPath(path)}` : toSlashPath(path);
}

function stdoutValue(stdout: string | null | undefined): string | null {
  const value = (stdout || "").trim();
  return value || null;
}
