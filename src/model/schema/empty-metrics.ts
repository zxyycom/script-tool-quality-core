import { METRICS_SCHEMA_VERSION } from "./types.ts";
import type {
  QualityMetrics,
  ScanMetadata,
  ToolInfo
} from "./types.ts";

export function createEmptyMetrics(options: {
  configVersion: string;
  commitSha: string;
  commitTitle?: string | null;
  repository: string;
  scope: ScanMetadata["scope"];
  tools: ToolInfo[];
}): QualityMetrics {
  return {
    metadata: {
      schemaVersion: METRICS_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      repository: options.repository,
      commitSha: options.commitSha,
      commitTitle: options.commitTitle ?? null,
      tools: options.tools,
      scope: options.scope,
      configVersion: options.configVersion
    },
    baseline: {
      status: "history-unavailable",
      commitSha: null,
      commitDate: null,
      metadata: null
    },
    comparisonStatus: "baseline-unavailable",
    currentFingerprints: {},
    fileMetrics: [],
    functionMetrics: [],
    duplicateCode: [],
    aggregates: {
      byLanguage: [],
      byCodeArea: [],
      overall: { totalFiles: 0, totalLines: 0, totalCodeLines: 0, totalFunctions: 0 }
    },
    trends: [],
    warnings: {
      all: [],
      changed: [],
      regressions: []
    }
  };
}
