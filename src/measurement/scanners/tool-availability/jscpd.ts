import type { ToolAvailability, ToolConfig } from "../../../model/schema.ts";
import { isMissingExplicitCommand } from "../command-path.ts";
import { parseJscpdVersionOutput } from "../jscpd/scanner.ts";
import {
  processFailure,
  runToolCommand,
  versionOutput,
  type ToolCommandResult
} from "./command.ts";

export async function checkJscpd(
  rootDir: string,
  toolConfig: ToolConfig
): Promise<ToolAvailability> {
  if (isMissingExplicitCommand(toolConfig.command)) {
    return unavailableJscpd("jscpd dependency binary unavailable", "tool-unavailable");
  }

  try {
    const result = await runToolCommand(rootDir, toolConfig, ["--version"]);
    return jscpdAvailabilityFromVersionResult(result);
  } catch (error: unknown) {
    return error instanceof Error
      ? jscpdProcessErrorAvailability(error)
      : unavailableJscpd("unknown error", "execution-error");
  }
}

function jscpdAvailabilityFromVersionResult(result: ToolCommandResult): ToolAvailability {
  if (result.error) {
    return jscpdProcessErrorAvailability(result.error);
  }

  const output = versionOutput(result);
  if (result.status !== 0) {
    return unavailableJscpd(
      `jscpd --version failed, ${processFailure(result)}${output ? `: ${output}` : ""}`,
      "execution-error"
    );
  }

  return {
    name: "jscpd",
    available: true,
    version: parseJscpdVersionOutput(output),
    error: null,
    source: "repository devDependency",
    reason: null
  };
}

function jscpdProcessErrorAvailability(error: Error): ToolAvailability {
  const code = (error as NodeJS.ErrnoException).code;
  const isMissingTool = code === "ENOENT";
  return unavailableJscpd(
    isMissingTool ? "jscpd dependency binary unavailable" : `jscpd version error: ${error.message}`,
    isMissingTool ? "tool-unavailable" : "execution-error"
  );
}

function unavailableJscpd(error: string, reason: NonNullable<ToolAvailability["reason"]>): ToolAvailability {
  return {
    name: "jscpd",
    available: false,
    version: null,
    error,
    source: "repository devDependency",
    reason
  };
}
