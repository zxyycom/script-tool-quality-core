import type {
  DuplicateCodeFragment,
  FileMetric,
  FunctionMetric,
  QualityConfig,
  WarningRecord
} from "../../model/schema.ts";

export type WarningBaseline = {
  duplicates: DuplicateCodeFragment[];
  files: FileMetric[];
  functions: FunctionMetric[];
} | null;

export type GenerateWarningsParams = {
  baseline: WarningBaseline;
  comparisonStatus: string;
  config: QualityConfig;
  duplicates: DuplicateCodeFragment[];
  files: FileMetric[];
  functions: FunctionMetric[];
  scope: { changed: boolean; changedFiles: string[] };
  validateAcceptedWarnings?: boolean;
};

export type AreaWarningPolicy = {
  isWatchlistOnly: boolean;
  level: "info" | "warning";
};

export type MetricWarningSpec = {
  areaPolicy: AreaWarningPolicy;
  baselineValue: number | null;
  codeArea: string;
  deltaFloor: number;
  deltaValue: number | null;
  floor: number;
  isChanged: boolean;
  line: number | null;
  message: string;
  metric: string;
  path: string;
  ruleId: string;
  sourceTool: string;
  suggestion: string;
  value: number | null;
};

export type WarningContext = {
  baselineDuplicateIndex: Map<string, number>;
  baselineFiles: Map<string, FileMetric>;
  baselineFunctions: Map<string, FunctionMetric>;
  config: QualityConfig;
  hasBaselineDuplicates: boolean;
  hasBaselineFiles: boolean;
  hasBaselineFunctions: boolean;
};

export type WarningCandidate = {
  deltaFloor: number;
  isWatchlistOnly: boolean;
  record: WarningRecord;
};
