import type { ToolAvailability, ToolConfig } from "../../../model/schema.ts";
import { SCC_VERSION_OUTPUT } from "../scc.ts";
import {
  processFailure,
  runToolCommand,
  versionOutput,
  type ToolCommandResult
} from "./command.ts";

export async function checkScc(rootDir: string, toolConfig: ToolConfig): Promise<ToolAvailability> {
  try {
    const result = await runToolCommand(rootDir, toolConfig, ["--version"]);
    return sccAvailabilityFromVersionResult(result);
  } catch {
    return unavailableScc("unknown error", "execution-error");
  }
}

function sccAvailabilityFromVersionResult(result: ToolCommandResult): ToolAvailability {
  if (result.error) {
    return sccProcessErrorAvailability(result.error);
  }

  const version = versionOutput(result);
  if (result.status !== 0) {
    return unavailableScc(
      `scc --version failed, ${processFailure(result)}${version ? `: ${version}` : ""}`,
      "execution-error"
    );
  }

  if (version !== SCC_VERSION_OUTPUT) {
    return unavailableScc(
      `expected ${SCC_VERSION_OUTPUT}, got "${version || "unknown"}"`,
      "contract-error"
    );
  }

  return { name: "scc", available: true, version, error: null, source: "system", reason: null };
}

function sccProcessErrorAvailability(error: Error): ToolAvailability {
  const code = (error as NodeJS.ErrnoException).code;
  const isMissingTool = code === "ENOENT";
  return unavailableScc(
    isMissingTool ? `scc not installed: ${error.message}` : `scc version error: ${error.message}`,
    isMissingTool ? "tool-unavailable" : "execution-error"
  );
}

function unavailableScc(error: string, reason: NonNullable<ToolAvailability["reason"]>): ToolAvailability {
  return {
    name: "scc",
    available: false,
    version: null,
    error,
    source: "system",
    reason
  };
}
