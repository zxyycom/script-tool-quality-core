import { writeJsonFile } from "../../../foundation/src/index.ts";

export function writeQualityJsonArtifact(filePath: string, value: unknown): void {
  writeJsonFile(filePath, value, { trailingNewline: false });
}
