/**
 * Current revision quality scan runner.
 */

import { buildAggregates } from "../aggregate.ts";
import { runJscpdScan } from "./jscpd.ts";
import { runLizardScan } from "./lizard.ts";
import { runSccScan } from "./scc.ts";
import type { ScanContext } from "./scan-context.ts";
import type { CodeAreaFileMap } from "../../model/schema.ts";
import type { QualityScanProfile } from "../../scan-command/command-model.ts";

export async function runCurrentRevisionScan({
  context,
  scanFiles,
  fileMap,
  scanProfile
}: {
  context: ScanContext;
  fileMap: CodeAreaFileMap;
  scanProfile: QualityScanProfile;
  scanFiles: string[];
}): Promise<void> {
  runSccScan(context, scanFiles);
  runLizardScan(context, scanFiles);
  if (scanProfile === "full") {
    await runJscpdScan(context, fileMap);
  } else {
    console.log("Skipping jscpd duplicate detection for quick quality check");
  }

  context.metrics.aggregates = buildAggregates({
    fileMetrics: context.metrics.fileMetrics,
    functionMetrics: context.metrics.functionMetrics,
    duplicateCode: context.metrics.duplicateCode,
    byLanguage: context.metrics.aggregates.byLanguage,
    config: context.config
  });
}
