import type {
  CodeAreaFingerprint,
  FatalIssue,
  QualityConfig,
  QualityMetrics,
  ToolAvailability
} from "../../model/schema.ts";

export type ScanContext = {
  cacheRootDir: string;
  changedFiles: string[];
  config: QualityConfig;
  fatalIssues: FatalIssue[];
  fingerprints: Record<string, CodeAreaFingerprint>;
  metrics: QualityMetrics;
  rawDir: string;
  root: string;
  toolResults: ToolAvailability[];
};
