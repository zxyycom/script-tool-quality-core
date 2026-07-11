/**
 * Repository file discovery and fingerprint helpers for quality scans.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { minimatch } from "minimatch";

import { buildFingerprint, isExcluded } from "../model/code-areas.ts";
import { collectSubmoduleWorktreeFiles } from "./revision-tree.ts";
import { getRevisionChangedFiles, getWorkingTreeChangedFiles } from "./revisions.ts";
import { gitGlobPathspecArgs } from "./git-pathspec.ts";
import { processFailed, runGit, splitGitFileList, toSlashPath, walkFiles } from "../../../foundation/src/index.ts";
import type { CodeAreaFileMap, CodeAreaFingerprint, QualityConfig } from "../model/schema.ts";

export type ScanInputConfig = Pick<QualityConfig, "excludeDirs" | "generatedFiles" | "include">;

export type ChangedFilesOptions = {
  changedFiles?: string | null;
  scanInputPaths?: string[] | readonly string[];
};

export function collectScanFiles(rootDir: string, config: ScanInputConfig): string[] {
  const pathspecArgs = gitGlobPathspecArgs(config.include);
  const result = runGit([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    ...pathspecArgs
  ], {
    cwd: rootDir,
    maxBuffer: 1024 * 1024 * 64
  });

  if (processFailed(result)) {
    console.log("  ⚠️  git ls-files failed, using fallback file collection");
    return collectFilesFallback(rootDir, config);
  }

  return normalizeAndFilterFiles([
    ...splitGitFileList(result.stdout),
    ...collectSubmoduleWorktreeFiles(rootDir, config.include)
  ], config, rootDir);
}

export function collectBaselineFiles(workDir: string, config: ScanInputConfig): string[] {
  const pathspecArgs = gitGlobPathspecArgs(config.include);
  const result = runGit([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    ...pathspecArgs
  ], {
    cwd: workDir,
    maxBuffer: 1024 * 1024 * 64
  });

  if (!processFailed(result) && result.stdout.trim()) {
    return normalizeAndFilterFiles([
      ...splitGitFileList(result.stdout),
      ...collectSubmoduleWorktreeFiles(workDir, config.include)
    ], config, workDir);
  }

  return collectBaselineFilesFallback(workDir, config);
}

export function getChangedFileList(opts: ChangedFilesOptions, rootDir: string): string[] {
  if (opts.changedFiles) {
    try {
      return readFileSync(opts.changedFiles, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map(toSlashPath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`failed to read --changed-files ${opts.changedFiles}: ${reason}`, {
        cause: error
      });
    }
  }

  const scanInputPaths = opts.scanInputPaths ?? [];
  const committedChangedFiles = getRevisionChangedFiles(
    rootDir,
    "HEAD~1",
    "HEAD",
    scanInputPaths
  );
  const workingTreeChangedFiles = getWorkingTreeChangedFiles(rootDir, [...(opts.scanInputPaths ?? [])])
    .map(toSlashPath);

  return uniqueSorted([...committedChangedFiles, ...workingTreeChangedFiles]);
}

export function buildFingerprints(fileMap: CodeAreaFileMap, rootDir: string): Record<string, CodeAreaFingerprint> {
  const fingerprints: Record<string, CodeAreaFingerprint> = {};

  for (const [area, files] of fileMap.entries()) {
    fingerprints[area] = buildFingerprint(area, files, (filePath) => {
      const absPath = resolve(rootDir, filePath);
      try {
        const content = normalizeFingerprintText(readFileSync(absPath, "utf8"));
        return createHash("sha256").update(content).digest("hex");
      } catch {
        return "file-not-readable";
      }
    });
  }

  return fingerprints;
}

function normalizeFingerprintText(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

function collectFilesFallback(rootDir: string, config: ScanInputConfig): string[] {
  const files: string[] = [];

  for (const relPath of walkFiles(rootDir, { ignoredDirs: config.excludeDirs })) {
    if (isScanInputFile(relPath, config)) {
      files.push(relPath);
    }
  }

  return uniqueSorted(files);
}

function collectBaselineFilesFallback(workDir: string, config: ScanInputConfig): string[] {
  const files: string[] = [];

  for (const relPath of walkFiles(workDir, { ignoredDirs: config.excludeDirs })) {
    if (isScanInputFile(relPath, config)) {
      files.push(relPath);
    }
  }

  return uniqueSorted(files);
}

function normalizeAndFilterFiles(files: string[], config: ScanInputConfig, rootDir: string): string[] {
  return uniqueSorted(
    files
      .map(toSlashPath)
      .filter((f) => existsSync(resolve(rootDir, f)))
      .filter((f) => isScanInputFile(f, config))
  );
}

function isScanInputFile(filePath: string, config: ScanInputConfig): boolean {
  const normalized = toSlashPath(filePath);
  return config.include.some((pattern) => minimatch(normalized, pattern)) &&
    !isExcluded(normalized, config.excludeDirs, config.generatedFiles);
}

function uniqueSorted(files: string[]): string[] {
  return [...new Set(files)].sort();
}
