export const METRICS_SCHEMA_VERSION = "0.4.0";

export const BASELINE_STATUSES = Object.freeze([
  "generated",
  "baseline-skipped",
  "history-unavailable",
  "no-baseline-commit",
  "baseline-materialization-failed",
  "baseline-scan-failed"
]);

export const COMPARISON_STATUSES = Object.freeze([
  "compared",
  "input-unchanged",
  "baseline-unavailable"
]);

export const WARNING_LEVELS = Object.freeze(["info", "warning", "error"]);

export const WARNING_POLICIES = Object.freeze([
  "strict",
  "moderate",
  "relaxed",
  "watchlist-only",
  "exclude-warnings"
]);

export type BaselineStatus = typeof BASELINE_STATUSES[number];
export type CodeAreaWarningPolicy = typeof WARNING_POLICIES[number];
export type ComparisonStatus = typeof COMPARISON_STATUSES[number];
export type WarningLevel = typeof WARNING_LEVELS[number];

export interface ToolInfo {
  name: string;
  source: string;
  version: string;
}

export interface ToolAvailability {
  available: boolean;
  error?: string | null;
  name: string;
  reason?: string | null;
  source: string;
  version: string | null;
}

export interface ToolConfig {
  args: string[];
  command: string;
}

export interface CodeAreaDefinition {
  description: string;
  excludeGlobs: string[];
  globs: string[];
  warningPolicy: CodeAreaWarningPolicy;
}

export interface QualityConfig {
  acceptedWarnings: readonly AcceptedWarningConfig[];
  artifactDir: string;
  cacheDir: string;
  codeAreas: Record<string, CodeAreaDefinition>;
  excludeDirs: string[];
  generatedFiles: string[];
  include: string[];
  lizard: {
    cyclomaticComplexity: QualityThreshold;
    functionCodeDensity: FunctionCodeDensityThreshold;
    parameterCount: QualityThreshold;
  };
  jscpd: {
    defaultMinimumTokens: number;
    duplicateFragments: { changedDelta: number };
    formatByCodeArea: Record<string, string | null>;
    maxParallelTasks: number;
    minimumTokens: Record<string, number>;
  };
  report: {
    footerGeneratedBy: string;
    footerNotice: string;
    nonBlockingNotice: string;
    showWatchlist: boolean;
    timeZone: string;
    title: string;
    topN: number;
    watchlistMax: number;
  };
  scc: {
    fileCodeLines: QualityThreshold & {
      lowDecisionTokenAllowance: {
        codeLineFloor: number;
        maxDecisionTokens: number;
      };
    };
  };
  tools: {
    lizard: ToolConfig;
    jscpd: ToolConfig;
    scc: ToolConfig;
  };
  version: string;
}

export interface AcceptedWarningConfig {
  codeArea?: string;
  messageIncludes?: readonly string[];
  metric?: string;
  path?: string;
  reason: string;
  ruleId: string;
  sourceTool?: string;
  suggestionIncludes?: readonly string[];
  value?: number;
}

export interface QualityThreshold {
  absoluteFloor: number;
  changedDelta: number;
}

export interface FunctionCodeDensityThreshold extends QualityThreshold {
  lowComplexityAllowance: {
    codeLineFloor: number;
    maxCyclomaticComplexityExclusive: number;
  };
}

export interface ScanMetadata {
  commitDate?: string;
  commitSha: string;
  commitTitle: string | null;
  configVersion: string;
  repository: string;
  schemaVersion: string;
  scope: {
    excludeDirs: string[];
    generatedFiles: string[];
    include: string[];
  };
  timestamp: string;
  tools: ToolInfo[];
}

export interface CodeAreaFingerprint {
  fileCount: number;
  fileList: string[];
  fingerprint: string;
}

export type CodeAreaFileMap = Map<string, string[]>;

export interface BaselineMetadata {
  commitDate: string | null;
  commitSha: string;
  commitTitle: string | null;
  configVersion: string;
  selectionReason: string;
  toolMetadata: ToolInfo[];
}

export interface MetricValue {
  source: string;
  value: number | null;
}

export interface FileMetric {
  blankLines?: number;
  codeArea: string;
  codeLines?: number;
  commentLines?: number;
  decisionTokens: MetricValue;
  isChanged: boolean;
  language: string;
  lines: number;
  path: string;
}

export interface FunctionMetric {
  codeArea: string;
  cyclomaticComplexity: MetricValue;
  endLine: number;
  file: string;
  isChanged: boolean;
  lines: number;
  name: string;
  parameterCount: number;
  startLine: number;
}

export interface DuplicateCodeLocation {
  codeArea: string;
  endLine: number;
  path: string;
  startLine: number;
}

export interface DuplicateCodeFragment {
  codeAreas: string[];
  hitsChangedScope: boolean;
  id: number;
  lineCount: number;
  locations: DuplicateCodeLocation[];
  tokenCount: number;
}

export interface LanguageAggregate {
  blankLines: number;
  codeLines: number;
  comments?: number;
  commentLines: number;
  files: number;
  language: string;
  lines: number;
}

export interface CodeAreaAggregate {
  codeArea: string;
  codeLines?: number;
  cyclomaticComplexity?: number;
  duplicateFragments?: number;
  fileDecisionTokens?: number;
  files: number;
  functionLines?: number;
  functions: number;
  lines: number;
  parameterCount?: number;
  warningPolicy: CodeAreaWarningPolicy | string;
}

export interface AggregateMetrics {
  byCodeArea: CodeAreaAggregate[];
  byLanguage: LanguageAggregate[];
  overall: {
    totalCodeLines: number;
    totalDuplicateFragments?: number;
    totalFileDecisionTokens?: number;
    totalFiles: number;
    totalFunctionCyclomaticComplexity?: number;
    totalFunctionLines?: number;
    totalFunctionParameters?: number;
    totalFunctions: number;
    totalLines: number;
  };
}

export interface TrendDelta {
  baseline: number | null;
  current: number | null;
  delta: number | null;
  metric: string;
  percentChange: number | null;
  unit: string;
}

export interface WarningRecord {
  acceptedReason?: string;
  baselineValue: number | null;
  codeArea: string;
  comparisonBasis: string;
  deltaValue: number | null;
  isChanged: boolean;
  level: WarningLevel | string;
  line: number | null;
  message: string;
  metric: string;
  path: string;
  ruleId: string;
  sourceTool: string;
  suggestion?: string;
  value: number;
}

export interface WarningChannels {
  all: WarningRecord[];
  changed: WarningRecord[];
  regressions: WarningRecord[];
}

export interface QualityMetrics {
  aggregates: AggregateMetrics;
  baseline: {
    commitDate: string | null;
    commitSha: string | null;
    metadata: BaselineMetadata | null;
    status: BaselineStatus | string;
  };
  baselineFingerprints?: Record<string, CodeAreaFingerprint>;
  comparisonStatus: ComparisonStatus | string;
  currentFingerprints: Record<string, CodeAreaFingerprint>;
  duplicateCode: DuplicateCodeFragment[];
  fileMetrics: FileMetric[];
  functionMetrics: FunctionMetric[];
  metadata: ScanMetadata;
  trends: TrendDelta[];
  warnings: WarningChannels;
}

export interface BaselineSnapshot {
  aggregates: AggregateMetrics;
  duplicateCode: DuplicateCodeFragment[];
  fileMetrics: FileMetric[];
  fingerprints: Record<string, CodeAreaFingerprint>;
  functionMetrics: FunctionMetric[];
}

export interface FatalIssue {
  error: string;
  phase: string;
  tool: string;
}

export interface MetricsValidationResult {
  errors: string[];
  valid: boolean;
}
