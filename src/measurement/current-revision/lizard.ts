import { join } from "node:path";

import { writeQualityJsonArtifact } from "../../output/artifacts.ts";
import { scanWithLizard } from "../scanners/lizard.ts";
import {
  isToolAvailable,
  normalizeFunctionMetrics,
  selectLizardTargetFiles
} from "../metrics.ts";
import type { ScanContext } from "./scan-context.ts";

export function runLizardScan(context: ScanContext, scanFiles: string[]): void {
  const { metrics, toolResults, rawDir, fatalIssues, root, config } = context;
  if (!isToolAvailable(toolResults, "lizard")) return;

  console.log("Running Lizard...");

  const targetFiles = selectLizardTargetFiles(scanFiles, config);
  console.log(`  Lizard targets: ${targetFiles.length} files`);

  const lizardResult = scanWithLizard({
    files: targetFiles,
    cwd: root,
    toolConfig: config.tools.lizard
  });

  const allFunctions = lizardResult.ok ? (lizardResult.functions ?? []) : [];
  if (!lizardResult.ok) {
    fatalIssues.push({ tool: "lizard", phase: "current-scan", error: lizardResult.error });
    console.log(`  ❌ Lizard execution/config/schema error: ${lizardResult.error}`);
  }

  metrics.functionMetrics = normalizeFunctionMetrics(allFunctions, {
    changedFiles: context.changedFiles,
    config
  });

  console.log(`  Lizard: ${metrics.functionMetrics.length} functions`);

  writeQualityJsonArtifact(join(rawDir, "lizard-functions.json"), metrics.functionMetrics);
}
