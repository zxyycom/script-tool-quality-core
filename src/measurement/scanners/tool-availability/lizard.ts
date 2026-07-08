import type { ToolAvailability, ToolConfig } from "../../../model/schema.ts";
import { runToolCommand, versionOutput } from "./command.ts";

export async function checkLizard(rootDir: string, toolConfig: ToolConfig): Promise<ToolAvailability> {
  try {
    const result = await runToolCommand(rootDir, toolConfig, ["--version"]);
    if (result.error) {
      return {
        name: "lizard",
        available: false,
        version: null,
        error: `lizard version error: ${result.error.message}`,
        source: "uv"
      };
    }

    const version = versionOutput(result);
    if (!version && result.status !== 0) {
      return {
        name: "lizard",
        available: false,
        version: null,
        error: `lizard --version failed, exit ${result.status}`,
        source: "uv"
      };
    }

    return { name: "lizard", available: true, version: version || "unknown", error: null, source: "uv" };
  } catch {
    return { name: "lizard", available: false, version: null, error: "unknown error", source: "uv" };
  }
}
