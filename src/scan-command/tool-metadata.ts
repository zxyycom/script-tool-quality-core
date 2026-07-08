import { gitCommitTitle as readGitCommitTitle, gitHeadSha } from "../../../foundation/src/index.ts";
import { checkTools } from "../measurement/scanners/tool-availability/index.ts";
import type { QualityConfig, ToolAvailability, ToolInfo } from "../model/schema.ts";

export async function initializeToolResults(rootDir: string, tools: QualityConfig["tools"]): Promise<ToolAvailability[]> {
  console.log("Checking tool availability...");
  const toolResults = await checkTools(rootDir, tools);
  const availableTools = toolResults.filter((tool) => tool.available);
  console.log(`  Available: ${availableTools.map((tool) => tool.name).join(", ") || "none"}`);

  for (const tool of toolResults) {
    if (tool.available) continue;

    console.log(`  ⚠️  ${tool.name} validation failed: ${tool.error || "not found"} (skipped)`);
  }

  return toolResults;
}

export function collectToolMetadata(toolResults: ToolAvailability[]): ToolInfo[] {
  return toolResults
    .filter((tool): tool is ToolAvailability & { version: string } => tool.available && typeof tool.version === "string")
    .map((tool) => ({
      name: tool.name,
      version: tool.version,
      source: tool.source
    }));
}

export function getGitSha(cwd: string): string {
  return gitHeadSha(cwd) ?? "unknown";
}

export function getGitCommitTitle(sha: string, cwd: string): string | null {
  return readGitCommitTitle(sha, cwd);
}
