import { join } from "node:path";

import { writeQualityJsonArtifact } from "../../output/artifacts.ts";
import { scanWithScc } from "../scanners/scc.ts";
import { isToolAvailable, normalizeFileMetrics } from "../metrics.ts";
import type { ScanContext } from "./scan-context.ts";

export function runSccScan(context: ScanContext, scanFiles: string[]): void {
  const { metrics, toolResults, rawDir, fatalIssues, root, config } = context;
  if (!isToolAvailable(toolResults, "scc")) return;

  console.log("Running scc...");

  const sccResult = scanWithScc({
    cwd: root,
    includePaths: scanFiles,
    excludeDirs: config.excludeDirs,
    toolConfig: config.tools.scc
  });

  if (sccResult.ok) {
    metrics.fileMetrics = normalizeFileMetrics(sccResult.files ?? [], {
      changedFiles: context.changedFiles,
      config
    });
    metrics.aggregates.byLanguage = sccResult.aggregates?.byLanguage ?? [];
    console.log(`  scc: ${metrics.fileMetrics.length} files, ${metrics.aggregates.byLanguage.length} languages`);
  } else {
    fatalIssues.push({ tool: "scc", phase: "current-scan", error: sccResult.error });
    console.log(`  ❌ scc execution/config/schema error: ${sccResult.error}`);
  }

  writeQualityJsonArtifact(join(rawDir, "scc-output.json"), metrics.fileMetrics);
}
