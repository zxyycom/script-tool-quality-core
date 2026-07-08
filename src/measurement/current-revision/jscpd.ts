import { join } from "node:path";

import { writeQualityJsonArtifact } from "../../output/artifacts.ts";
import { scanJscpdAreasWithCache } from "../scanners/jscpd/area-scans.ts";
import { isToolAvailable } from "../metrics.ts";
import type { ScanContext } from "./scan-context.ts";
import type { CodeAreaFileMap } from "../../model/schema.ts";

export async function runJscpdScan(context: ScanContext, fileMap: CodeAreaFileMap): Promise<void> {
  const { metrics, toolResults, changedFiles, rawDir, root, cacheRootDir, config, fatalIssues } = context;
  if (!isToolAvailable(toolResults, "jscpd")) {
    console.log("  jscpd not available, skipping duplicate detection");
    return;
  }

  console.log("Running jscpd...");

  const allFragments = await scanJscpdAreasWithCache({
    cacheRootDir,
    changedFiles,
    commitSha: metrics.metadata.commitSha,
    config,
    cwd: root,
    failOnSkipped: false,
    fatalIssues,
    fileMap,
    fingerprints: context.fingerprints,
    logPrefix: "  ",
    scanKind: "current",
    toolResults
  });

  metrics.duplicateCode = allFragments;

  console.log(`  jscpd total: ${allFragments.length} duplicate fragments`);

  writeQualityJsonArtifact(join(rawDir, "jscpd-fragments.json"), metrics.duplicateCode);
}
