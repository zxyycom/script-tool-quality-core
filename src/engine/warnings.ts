import type {
  BaselineSnapshot,
  QualityConfig,
  QualityMetrics
} from "../model/schema.ts";
import { generateWarningChannels } from "../output/warnings/generator.ts";
import type {
  ChangeScope,
  QualityScanOptions,
  Timings
} from "../scan-command/index.ts";

type GenerateScanWarningsOptions = {
  baselineSnapshot: BaselineSnapshot | null;
  config: QualityConfig;
  metrics: QualityMetrics;
  scanProfile: QualityScanOptions["scanProfile"];
  scope: ChangeScope;
  timings: Timings;
};

export function generateScanWarnings(options: GenerateScanWarningsOptions): void {
  const { baselineSnapshot, config, metrics, scanProfile, scope, timings } = options;

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
