import { runProcess } from "../../../../../foundation/src/index.ts";
import type { ToolConfig } from "../../../model/schema.ts";

export type ToolCommandResult = Awaited<ReturnType<typeof runToolCommand>>;

export function runToolCommand(rootDir: string, toolConfig: ToolConfig, args: string[]) {
  return runProcess({
    args: [...toolConfig.args, ...args],
    command: toolConfig.command,
    cwd: rootDir
  });
}

export function versionOutput(result: ToolCommandResult): string {
  return (result.stdout || "").trim() || (result.stderr || "").trim();
}

export function processFailure(result: ToolCommandResult): string {
  return typeof result.status === "number"
    ? `exit ${result.status}`
    : `signal ${result.signal || "unknown"}`;
}
