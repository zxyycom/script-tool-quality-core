import { resolve } from "node:path";

import { errorMessage } from "../../foundation/src/index.ts";
import { classifyFiles } from "./model/code-areas.ts";
import { createEmptyMetrics } from "./model/schema.ts";
import type {
  BaselineSnapshot,
  CodeAreaFileMap,
  CodeAreaFingerprint,
  FatalIssue,
  QualityConfig,
  QualityMetrics,
  ToolAvailability
} from "./model/schema.ts";
import { detectScanInputChange } from "./input/revisions.ts";
import { buildFingerprints, collectScanFiles } from "./input/files.ts";
import { runCurrentRevisionScan } from "./measurement/current-revision/index.ts";
import { generateWarningChannels } from "./output/warnings/generator.ts";
import type { ChangeScope, QualityScanOptions } from "./scan-command/index.ts";
import {
  collectToolMetadata,
  configureBaseline,
  createTimings,
  formatFatalIssue,
  getGitCommitTitle,
  getGitSha,
  initializeToolResults,
  logFingerprints,
  maybeScanBaselineRevision,
  prepareArtifactDirs,
  printSummary,
  printWarningStatus,
  qualityCheckStatus,
  resolveChangedFilesForScan,
  setComparisonStatus,
  validateOutput,
  writeArtifacts,
  type Timings
} from "./scan-command/index.ts";

export type QualityScanRuntimeOptions = {
  config: QualityConfig;
  root: string;
  options: QualityScanOptions;
  banner?: (scanProfile: QualityScanOptions["scanProfile"]) => void;
  timingsEnabled?: boolean;
};

type ScanInputs = {
  fileMap: CodeAreaFileMap;
  fingerprints: Record<string, CodeAreaFingerprint>;
  scanFiles: string[];
};

type ChangedInputScope = {
  changedFiles: string[];
  inputScope: ChangeScope;
};

type RuntimeContext = {
  config: QualityConfig;
  fatalIssues: FatalIssue[];
  metrics: QualityMetrics;
  opts: QualityScanOptions;
  rawDir: string;
  root: string;
  toolResults: ToolAvailability[];
};

export async function runQualityScan({
  banner,
  config,
  options,
  root,
  timingsEnabled
}: QualityScanRuntimeOptions): Promise<"passed" | "warning" | "failed"> {
  const timings = createTimings(timingsEnabled);
  const opts = options;

  banner?.(opts.scanProfile);

  const artifactDir = resolve(root, opts.artifactDir);
  const { rawDir } = timings.measure("prepare artifact dirs", () => prepareArtifactDirs(artifactDir));
  const runtime = await prepareRuntimeContext({ config, opts, rawDir, root, timings });
  const inputs = collectScanInputs({ config, root, timings });
  attachFingerprints(runtime.metrics, inputs.fingerprints);

  timings.measure("configure baseline", () => configureBaseline({
    config,
    metrics: runtime.metrics,
    opts,
    tools: runtime.metrics.metadata.tools,
    root
  }));

  const changedInput = detectChangedInputScope({ config, metrics: runtime.metrics, opts, root, timings });
  await scanCurrentRevision(runtime, inputs, changedInput.changedFiles, timings);
  timings.measure("set comparison status", () => setComparisonStatus(runtime.metrics, changedInput.inputScope));

  const baselineSnapshot = await timings.measureAsync("baseline snapshot", () =>
    maybeScanBaselineRevision({ config, root, runtime })
  );
  generateWarnings({
    baselineSnapshot,
    config,
    metrics: runtime.metrics,
    scanProfile: opts.scanProfile,
    scope: changedInput.inputScope,
    timings
  });
  return finishScan({ artifactDir, runtime, timings });
}

async function prepareRuntimeContext({
  config,
  opts,
  rawDir,
  root,
  timings
}: {
  config: QualityConfig;
  opts: QualityScanOptions;
  rawDir: string;
  root: string;
  timings: Timings;
}): Promise<RuntimeContext> {
  const commitSha = timings.measure("git rev-parse HEAD", () => getGitSha(root));
  const commitTitle = timings.measure("git commit title", () => getGitCommitTitle(commitSha, root));
  const toolResults = await timings.measureAsync("tool availability", () => initializeToolResults(root, config.tools));
  const tools = timings.measure("tool metadata", () => collectToolMetadata(toolResults));
  const metrics = timings.measure("create metrics envelope", () => createEmptyMetrics({
    repository: root,
    commitSha,
    commitTitle,
    configVersion: config.version,
    tools,
    scope: {
      include: config.include,
      excludeDirs: config.excludeDirs,
      generatedFiles: config.generatedFiles
    }
  }));

  return { config, fatalIssues: [], metrics, opts, rawDir, root, toolResults };
}

function collectScanInputs({
  config,
  root,
  timings
}: {
  config: QualityConfig;
  root: string;
  timings: Timings;
}): ScanInputs {
  console.log("Collecting scan inputs...");
  const scanFiles = timings.measure("collect scan files", () => collectScanFiles(root, config));
  console.log(`  Found ${scanFiles.length} files in scan scope`);

  const fileMap = timings.measure("classify scan files", () =>
    classifyFiles(scanFiles, config.codeAreas, config.generatedFiles)
  );
  const areaNames = Array.from(fileMap.keys());
  console.log(`  Code areas: ${areaNames.join(", ")}`);

  const fingerprints = timings.measure("build fingerprints", () => buildFingerprints(fileMap, root));
  logFingerprints(fingerprints);

  return { fileMap, fingerprints, scanFiles };
}

function attachFingerprints(
  metrics: QualityMetrics,
  fingerprints: Record<string, CodeAreaFingerprint>
): void {
  metrics.currentFingerprints = fingerprints;
}

function detectChangedInputScope({
  config,
  metrics,
  opts,
  root,
  timings
}: {
  config: QualityConfig;
  metrics: QualityMetrics;
  opts: QualityScanOptions;
  root: string;
  timings: Timings;
}): ChangedInputScope {
  const inputScope = timings.measure("detect changed scan inputs", () => detectScanInputChange({
    baselineSha: metrics.baseline.commitSha,
    cwd: root,
    scanInputPaths: config.include
  }));
  const changedFiles = timings.measure("resolve changed files", () =>
    resolveChangedFilesForScan({ config, opts, root, scope: inputScope })
  );
  console.log(`  Changed files in scan scope: ${changedFiles.length}`);
  return { changedFiles, inputScope };
}

async function scanCurrentRevision(
  runtime: RuntimeContext,
  inputs: ScanInputs,
  changedFiles: string[],
  timings: Timings
): Promise<void> {
  await timings.measureAsync("scan current revision", () => runCurrentRevisionScan({
    context: {
      metrics: runtime.metrics,
      toolResults: runtime.toolResults,
      changedFiles,
      rawDir: runtime.rawDir,
      fatalIssues: runtime.fatalIssues,
      root: runtime.root,
      cacheRootDir: resolve(runtime.root, runtime.config.cacheDir),
      fingerprints: inputs.fingerprints,
      config: runtime.config
    },
    scanFiles: inputs.scanFiles,
    fileMap: inputs.fileMap,
    scanProfile: runtime.opts.scanProfile
  }));
}

function generateWarnings({
  baselineSnapshot,
  config,
  metrics,
  scanProfile,
  scope,
  timings
}: {
  baselineSnapshot: BaselineSnapshot | null;
  config: QualityConfig;
  metrics: QualityMetrics;
  scanProfile: QualityScanOptions["scanProfile"];
  scope: ChangeScope;
  timings: Timings;
}): void {
  console.log("Generating warnings...");
  metrics.warnings = timings.measure("generate warnings", () => generateWarningChannels({
    files: metrics.fileMetrics,
    functions: metrics.functionMetrics,
    duplicates: metrics.duplicateCode,
    config,
    scope,
    baseline: baselineSnapshot
      ? {
          files: baselineSnapshot.fileMetrics,
          functions: baselineSnapshot.functionMetrics,
          duplicates: baselineSnapshot.duplicateCode
        }
      : null,
    comparisonStatus: metrics.comparisonStatus,
    validateAcceptedWarnings: scanProfile === "full"
  }));
  const warningCounts = [
    `all=${metrics.warnings.all.length}`,
    `changed=${metrics.warnings.changed.length}`,
    `regressions=${metrics.warnings.regressions.length}`,
    `withAcceptedReason=${metrics.warnings.all.filter((warning) => warning.acceptedReason).length}`
  ].join(", ");
  console.log(`  Warning records generated: ${warningCounts}`);
}

function finishScan({
  artifactDir,
  runtime,
  timings
}: {
  artifactDir: string;
  runtime: RuntimeContext;
  timings: Timings;
}): "passed" | "warning" | "failed" {
  const { fatalIssues, metrics, opts } = runtime;

  timings.measure("write artifacts", () =>
    writeArtifacts({
      artifactDir,
      metrics,
      reportOptions: runtime.config.report,
      reportTimeZone: runtime.config.report.timeZone,
      topN: opts.topN
    })
  );
  timings.measure("print summary", () => printSummary(metrics));
  const validation = timings.measure("validate output", () => validateOutput(metrics));
  recordValidationIssues(fatalIssues, validation.errors);

  if (fatalIssues.length > 0) {
    finishFatalScan(artifactDir, fatalIssues);
    return "failed";
  }

  timings.measure("print warning status", () =>
    printWarningStatus({
      artifactDir,
      metrics,
      scanProfile: opts.scanProfile,
      verificationOutput: opts.verificationOutput
    })
  );
  const status = qualityCheckStatus(metrics);
  printSuccessfulScanCompletion(status, artifactDir);

  timings.print();
  return status;
}

function recordValidationIssues(fatalIssues: FatalIssue[], validationErrors: string[]): void {
  if (validationErrors.length === 0) {
    return;
  }
  fatalIssues.push({
    tool: "metrics",
    phase: "validation",
    error: validationErrors.join("; ")
  });
}

function finishFatalScan(artifactDir: string, fatalIssues: FatalIssue[]): void {
  console.log("");
  console.log("❌ Quality scan failed.");
  console.log(`Artifacts in: ${artifactDir}/`);
  console.error("Fatal quality scan issues:");
  for (const issue of fatalIssues) {
    console.error(`  - ${formatFatalIssue(issue)}`);
  }
}

function printSuccessfulScanCompletion(status: "passed" | "warning", artifactDir: string): void {
  console.log("");
  console.log(successfulScanMessage(status));
  console.log(`Artifacts in: ${artifactDir}/`);
}

function successfulScanMessage(status: "passed" | "warning"): string {
  if (status === "warning") {
    return "⚠️ Quality scan complete with warnings.";
  }
  return "✅ Quality scan complete.";
}

export function qualityScanErrorExitCode(err: unknown): 2 | 3 {
  const message = errorMessage(err);
  return (err instanceof Error && "code" in err && err.code === "ENOENT") || message.includes("config") ? 3 : 2;
}
