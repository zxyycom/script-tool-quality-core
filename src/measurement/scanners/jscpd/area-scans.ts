/**
 * jscpd scan task planning and cache orchestration.
 */

import {
  loadScanCacheEntry,
  writeScanCacheEntry,
  type DuplicateCodeCacheIdentity,
  type ScanKind
} from "../../cache.ts";
import { isExcluded } from "../../../model/code-areas.ts";
import { scanWithJscpdAsync, type JscpdScanResult } from "./scanner.ts";
import { runBoundedTasks } from "./parallel.ts";
import type {
  CodeAreaFileMap,
  CodeAreaFingerprint,
  DuplicateCodeFragment,
  FatalIssue,
  QualityConfig,
  ToolAvailability
} from "../../../model/schema.ts";

export type JscpdAreaScanInput = {
  area: string;
  files: string[];
  minimumTokens: number;
};

export type JscpdAreaScanTask = {
  area: string;
  codeArea: string;
  files: string[];
  id: string;
  minimumTokens: number;
};

type JscpdAreaScanOptions = {
  cacheRootDir: string;
  changedFiles?: string[];
  commitSha: string;
  config: QualityConfig;
  cwd: string;
  failOnSkipped: boolean;
  fileMap: CodeAreaFileMap;
  fingerprints: Record<string, CodeAreaFingerprint>;
  fatalIssues?: FatalIssue[];
  logPrefix: string;
  scanKind: ScanKind;
  toolResults: ToolAvailability[];
};

type JscpdCacheMiss = JscpdAreaScanInput & {
  identity: DuplicateCodeCacheIdentity;
};

type JscpdAreaScanResult = {
  result: JscpdScanResult;
  task: JscpdAreaScanTask;
};

type JscpdAreaScanWork = {
  allFragments: DuplicateCodeFragment[];
  misses: JscpdCacheMiss[];
};

export async function scanJscpdAreasWithCache(options: JscpdAreaScanOptions): Promise<DuplicateCodeFragment[]> {
  const work = collectJscpdAreaScanWork(options);
  const tasks = planJscpdAreaScanTasks(work.misses);
  const taskResults = await runBoundedTasks(
    tasks,
    options.config.jscpd.maxParallelTasks,
    async (task) => runJscpdAreaScanTask(options, task)
  );

  appendJscpdAreaScanResults(options, work, taskResults);
  return work.allFragments;
}

function collectJscpdAreaScanWork(options: JscpdAreaScanOptions): JscpdAreaScanWork {
  const work: JscpdAreaScanWork = { allFragments: [], misses: [] };
  for (const [area, areaFiles] of options.fileMap.entries()) {
    const targetFiles = areaFiles.filter(
      (file) => !isExcluded(file, options.config.excludeDirs, options.config.generatedFiles)
    );
    const minTokens = options.config.jscpd.minimumTokens[area] ??
      options.config.jscpd.defaultMinimumTokens;
    const identity = createJscpdCacheIdentity(options, area, minTokens);
    const cached = loadScanCacheEntry({
      rootDir: options.cacheRootDir,
      identity
    });

    if (cached.hit) {
      const fragments = annotateJscpdFragments(cached.metrics, area, options.changedFiles);
      work.allFragments.push(...fragments);
      console.log(`${options.logPrefix}jscpd ${area}: ${fragments.length} duplicate fragments from cache`);
      continue;
    }

    if (targetFiles.length < 2) {
      console.log(`${options.logPrefix}jscpd ${area}: too few files (${targetFiles.length}), skipping`);
      continue;
    }

    work.misses.push({
      area,
      files: targetFiles,
      minimumTokens: minTokens,
      identity
    });
  }

  return work;
}

function appendJscpdAreaScanResults(
  options: JscpdAreaScanOptions,
  work: JscpdAreaScanWork,
  taskResults: JscpdAreaScanResult[]
): void {
  const missByArea = new Map(work.misses.map((miss) => [miss.area, miss]));
  for (const { task, result } of taskResults) {
    if (result.ok) {
      const miss = missByArea.get(task.area);
      if (!miss) continue;

      const fragments = annotateJscpdFragments(result.fragments ?? [], task.area, options.changedFiles);
      work.allFragments.push(...fragments);
      writeScanCacheEntry({
        rootDir: options.cacheRootDir,
        identity: miss.identity,
        metrics: fragments
      });
      console.log(`${options.logPrefix}  jscpd ${task.area}: found ${fragments.length} duplicate fragments`);
    } else {
      handleJscpdAreaScanFailure(options, task, result);
    }
  }
}

export function planJscpdAreaScanTasks(areas: JscpdAreaScanInput[]): JscpdAreaScanTask[] {
  return areas
    .filter((area) => area.files.length >= 2)
    .map((area) => ({
      area: area.area,
      codeArea: area.area,
      files: uniqueSorted(area.files),
      id: `jscpd:${area.area}`,
      minimumTokens: area.minimumTokens
    }));
}

function createJscpdCacheIdentity(
  options: JscpdAreaScanOptions,
  codeArea: string,
  minTokens: number
): DuplicateCodeCacheIdentity {
  const toolVersion = toolVersionFor(options.toolResults, "jscpd");
  if (!toolVersion) {
    throw new Error("missing available tool version for jscpd");
  }

  return {
    scanKind: options.scanKind,
    toolName: "jscpd",
    toolVersion,
    normalizedToolArgs: jscpdCacheArgs(options.config, codeArea, minTokens),
    configVersion: options.config.version,
    codeArea,
    commitSha: options.commitSha,
    inputFingerprint: options.fingerprints[codeArea] ?? {
      fileCount: 0,
      fileList: [],
      fingerprint: "empty"
    }
  };
}

function toolVersionFor(toolResults: ToolAvailability[], name: string): string | null {
  return toolResults.find((tool) => tool.name === name && tool.available)?.version ?? null;
}

function jscpdCacheArgs(config: QualityConfig, codeArea: string, minTokens: number): string[] {
  const format = config.jscpd.formatByCodeArea[codeArea] ?? null;
  return [
    normalizedJscpdCommandForCache(config.tools.jscpd.command),
    ...config.tools.jscpd.args,
    "--config",
    "<jscpd-config-with-input-fingerprint>",
    "--min-tokens",
    String(minTokens),
    "--reporters",
    "json",
    "--absolute",
    ...(format ? ["--format", format] : [])
  ];
}

function normalizedJscpdCommandForCache(command: string): string {
  const normalized = command.split("\\").join("/");
  return normalized.endsWith("/node_modules/.bin/jscpd") || normalized.endsWith("/node_modules/.bin/jscpd.cmd")
    ? "<repo-local-jscpd-bin>"
    : command;
}

async function runJscpdAreaScanTask(options: JscpdAreaScanOptions, task: JscpdAreaScanTask): Promise<JscpdAreaScanResult> {
  console.log(
    `${options.logPrefix}jscpd task ${task.id}: ${task.files.length} files, ` +
    `minimum tokens=${task.minimumTokens}`
  );

  const result = await scanWithJscpdAsync({
    files: task.files,
    cwd: options.cwd,
    toolConfig: options.config.tools.jscpd,
    minimumTokens: task.minimumTokens,
    format: options.config.jscpd.formatByCodeArea[task.codeArea] ?? null
  });

  return { task, result };
}

function handleJscpdAreaScanFailure(
  options: JscpdAreaScanOptions,
  task: JscpdAreaScanTask,
  result: Extract<JscpdScanResult, { ok: false }>
): void {
  const failure = result.skipped
    ? `jscpd scan skipped for task ${task.id}: ${result.error}`
    : `jscpd scan failed for task ${task.id}: ${result.error}`;

  if (result.skipped) {
    if (options.failOnSkipped) {
      throw new Error(`baseline ${failure}`);
    }
    recordCurrentJscpdFailure(options, failure);
    console.log(`${options.logPrefix}❌ ${failure}`);
    return;
  }

  if (options.failOnSkipped) {
    throw new Error(`baseline ${failure}`);
  }
  recordCurrentJscpdFailure(options, failure);
  console.log(`${options.logPrefix}❌ ${failure}`);
}

function recordCurrentJscpdFailure(options: JscpdAreaScanOptions, failure: string): void {
  if (!options.fatalIssues) {
    throw new Error(failure);
  }
  options.fatalIssues.push({ tool: "jscpd", phase: "current-scan", error: failure });
}

function annotateJscpdFragments(
  fragments: DuplicateCodeFragment[],
  area: string,
  changedFiles: string[] | undefined
): DuplicateCodeFragment[] {
  return fragments.map((fragment) => ({
    ...fragment,
    codeAreas: [area],
    hitsChangedScope: changedFiles
      ? fragment.locations.some((location) => isInChangedScope(location.path, changedFiles))
      : false,
    locations: fragment.locations.map((location) => ({
      ...location,
      codeArea: area
    }))
  }));
}

function isInChangedScope(filePath: string, changedFiles: string[]): boolean {
  return changedFiles.some((changedFile) => filePath.includes(changedFile) || changedFile.includes(filePath));
}

function uniqueSorted(files: string[]): string[] {
  return [...new Set(files)].sort((a, b) => a.localeCompare(b));
}
