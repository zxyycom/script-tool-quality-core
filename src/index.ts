export { runQualityScan, qualityScanErrorExitCode, type QualityScanRuntimeOptions } from "./engine.ts";
export { classifyFiles } from "./model/code-areas.ts";
export {
  BASELINE_STATUSES,
  COMPARISON_STATUSES,
  createEmptyMetrics,
  METRICS_SCHEMA_VERSION,
  validateMetrics,
  WARNING_LEVELS,
  WARNING_POLICIES,
  type AcceptedWarningConfig,
  type AggregateMetrics,
  type BaselineMetadata,
  type BaselineSnapshot,
  type BaselineStatus,
  type CodeAreaAggregate,
  type CodeAreaDefinition,
  type CodeAreaFileMap,
  type CodeAreaFingerprint,
  type CodeAreaWarningPolicy,
  type ComparisonStatus,
  type DuplicateCodeFragment,
  type DuplicateCodeLocation,
  type FatalIssue,
  type FileMetric,
  type FunctionMetric,
  type LanguageAggregate,
  type MetricValue,
  type MetricsValidationResult,
  type QualityConfig,
  type QualityMetrics,
  type QualityThreshold,
  type ScanMetadata,
  type ToolAvailability,
  type ToolConfig,
  type ToolInfo,
  type TrendDelta,
  type WarningChannels,
  type WarningLevel,
  type WarningRecord
} from "./model/schema.ts";
export { buildAggregates } from "./measurement/aggregate.ts";
export { runBaselineRevisionScan } from "./measurement/baseline-revision.ts";
export {
  createBaselineSnapshotCacheIdentity,
  loadBaselineSnapshotCacheEntry,
  writeBaselineSnapshotCacheEntry,
  type BaselineSnapshotCacheIdentity
} from "./measurement/cache.ts";
export { runCurrentRevisionScan } from "./measurement/current-revision/index.ts";
export { generateTrends } from "./output/trends.ts";
export { generateWarningChannels } from "./output/warnings/generator.ts";
export { generateMarkdownReport } from "./output/report/markdown-report.ts";
export {
  collectScanFiles,
  buildFingerprints
} from "./input/files.ts";
export type { ChangeScope, QualityScanOptions, QualityScanProfile } from "./scan-command/command-model.ts";
export {
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
  qualityVerificationStatus,
  resolveChangedFilesForScan,
  setComparisonStatus,
  validateOutput,
  writeArtifacts,
  writeBaselineRawOutputs,
  type Timings
} from "./scan-command/index.ts";
