import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

export function isMissingExplicitCommand(command: string): boolean {
  return (isAbsolute(command) || command.includes("/") || command.includes("\\")) && !existsSync(command);
}
