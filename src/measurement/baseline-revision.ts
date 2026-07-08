/**
 * Baseline revision quality scan runner.
 */

import { scanWithLizard } from "./scanners/lizard.ts";
import { scanWithScc } from "./scanners/scc.ts";
import { scanJscpdAreasWithCache } from "./scanners/jscpd/area-scans.ts";
import { classifyFiles } from "../model/code-areas.ts";
import { buildAggregates } from "./aggregate.ts";
import { collectBaselineFiles, buildFingerprints } from "../input/files.ts";
import {
  isToolAvailable,
  normalizeFileMetrics,
  normalizeFunctionMetrics,
  selectLizardTargetFiles
} from "./metrics.ts";
import type {
  BaselineSnapshot,
  CodeAreaFileMap,
  CodeAreaFingerprint,
  DuplicateCodeFragment,
  FileMetric,
  FunctionMetric,
  LanguageAggregate,
  QualityConfig,
  ToolAvailability
} from "../model/schema.ts";

type BaselineScanOptions = {
  cacheRootDir?: string;
  commitSha?: string;
};

type BaselineScanContext = {
  cacheRootDir: string;
  commitSha: string;
  config: QualityConfig;
  fingerprints: Record<string, CodeAreaFingerprint>;
  toolResults: ToolAvailability[];
  workDir: string;
};

/**
 * 在 materialized baseline 目录中运行当前工具扫描。
 *
 * 只收集 fingerprints 和 baseline 指标明细用于趋势与 warning delta；
 * 不生成 baseline warnings。
 */
export async function runBaselineRevisionScan(
  workDir: string,
  toolResults: ToolAvailability[],
  config: QualityConfig,
  options: BaselineScanOptions = {}
): Promise<BaselineSnapshot> {
  const baselineFiles = collectBaselineFiles(workDir, config);
  const fileMap = classifyFiles(baselineFiles, config.codeAreas, config.generatedFiles);
  const fingerprints = buildFingerprints(fileMap, workDir);
  const context: BaselineScanContext = {
    workDir,
    toolResults,
    config,
    fingerprints,
    cacheRootDir: options.cacheRootDir ?? workDir,
    commitSha: options.commitSha ?? "baseline"
  };

  let fileMetrics: FileMetric[] = [];
  let functionMetrics: FunctionMetric[] = [];
  let duplicateCode: DuplicateCodeFragment[] = [];
  let byLanguage: LanguageAggregate[] = [];

  if (isToolAvailable(toolResults, "scc")) {
    ({ fileMetrics, byLanguage } = scanBaselineScc({ context, baselineFiles }));
  }

  if (isToolAvailable(toolResults, "lizard")) {
    functionMetrics = scanBaselineLizard({ context, baselineFiles });
  }

  if (isToolAvailable(toolResults, "jscpd")) {
    duplicateCode = await scanBaselineJscpd({ context, fileMap });
  }

  const aggregates = buildAggregates({
    fileMetrics,
    functionMetrics,
    duplicateCode,
    byLanguage,
    config
  });

  return { fingerprints, fileMetrics, functionMetrics, duplicateCode, aggregates };
}

function scanBaselineScc({
  baselineFiles,
  context
}: {
  baselineFiles: string[];
  context: BaselineScanContext;
}): { byLanguage: LanguageAggregate[]; fileMetrics: FileMetric[] } {
  console.log("  Running baseline scc...");
  const sccResult = scanWithScc({
    cwd: context.workDir,
    includePaths: baselineFiles,
    excludeDirs: context.config.excludeDirs,
    toolConfig: context.config.tools.scc
  });

  if (!sccResult.ok) {
    throw new Error(`baseline scc scan failed: ${sccResult.error}`);
  }

  const fileMetrics = normalizeFileMetrics(sccResult.files ?? [], { config: context.config });
  console.log(`    Baseline scc: ${fileMetrics.length} files`);
  return { fileMetrics, byLanguage: sccResult.aggregates?.byLanguage ?? [] };
}

function scanBaselineLizard({
  context,
  baselineFiles
}: {
  context: BaselineScanContext;
  baselineFiles: string[];
}): FunctionMetric[] {
  console.log("  Running baseline Lizard...");
  const targetFiles = selectLizardTargetFiles(baselineFiles, context.config);
  const lizardResult = scanWithLizard({
    files: targetFiles,
    cwd: context.workDir,
    toolConfig: context.config.tools.lizard
  });

  if (!lizardResult.ok) {
    throw new Error(`baseline lizard scan failed: ${lizardResult.error}`);
  }

  const functionMetrics = normalizeFunctionMetrics(lizardResult.functions ?? [], { config: context.config });
  console.log(`    Baseline Lizard: ${functionMetrics.length} functions`);
  return functionMetrics;
}

async function scanBaselineJscpd({
  context,
  fileMap
}: {
  context: BaselineScanContext;
  fileMap: CodeAreaFileMap;
}): Promise<DuplicateCodeFragment[]> {
  console.log("  Running baseline jscpd...");
  const fragments = await scanJscpdAreasWithCache({
    cacheRootDir: context.cacheRootDir,
    commitSha: context.commitSha,
    config: context.config,
    cwd: context.workDir,
    failOnSkipped: true,
    fileMap,
    fingerprints: context.fingerprints,
    logPrefix: "    ",
    scanKind: "baseline",
    toolResults: context.toolResults
  });

  console.log(`    Baseline jscpd: ${fragments.length} duplicate fragments`);
  return fragments;
}
