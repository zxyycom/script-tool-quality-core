import path from "node:path";

import type { DuplicateCodeFragment, DuplicateCodeLocation } from "../../../model/schema.ts";
import { errorMessage, isNonArrayRecord, toSlashPath } from "../../../../../foundation/src/index.ts";
import type { JscpdScanResult } from "./types.ts";

type JscpdFileLocation = {
  end?: unknown;
  endLoc?: unknown;
  name?: unknown;
  start?: unknown;
  startLoc?: unknown;
};

export function parseJscpdJsonReport(json: string, cwd: string): JscpdScanResult {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!isNonArrayRecord(parsed)) {
      throw new Error("jscpd JSON report must be an object");
    }

    const duplicates = parsed.duplicates;
    if (!Array.isArray(duplicates)) {
      throw new Error("jscpd JSON report must include duplicates array");
    }

    const fragments = duplicates
      .map((duplication, index) => {
        if (!isNonArrayRecord(duplication)) {
          throw new Error(`jscpd duplicate #${index + 1} must be an object`);
        }
        return parseJscpdFragment(duplication, cwd, index + 1);
      })
      .sort((a, b) => b.tokenCount - a.tokenCount);

    return { ok: true, fragments };
  } catch (error: unknown) {
    return {
      ok: false,
      skipped: false,
      error: `Failed to parse jscpd JSON: ${errorMessage(error)}`,
      reason: "jscpd-parse-failure"
    };
  }
}

function parseJscpdFragment(
  duplication: Record<string, unknown>,
  cwd: string,
  id: number
): DuplicateCodeFragment {
  const lineCount = integerField(duplication, "lines");
  const tokenCount = integerField(duplication, "tokens");
  const locations = parseJscpdLocations(duplication, cwd, lineCount);

  return {
    id,
    tokenCount,
    lineCount,
    locations,
    codeAreas: [],
    hitsChangedScope: false
  };
}

function parseJscpdLocations(
  duplication: Record<string, unknown>,
  cwd: string,
  lineCount: number
): DuplicateCodeLocation[] {
  return [
    parseJscpdLocationObject(duplication.firstFile, "firstFile"),
    parseJscpdLocationObject(duplication.secondFile, "secondFile")
  ].map((location) => parseJscpdLocation(location, cwd, lineCount));
}

function parseJscpdLocationObject(value: unknown, name: string): JscpdFileLocation {
  if (!isNonArrayRecord(value)) {
    throw new Error(`jscpd duplicate must include ${name} location object`);
  }
  return value;
}

function parseJscpdLocation(
  location: JscpdFileLocation,
  cwd: string,
  lineCount: number
): DuplicateCodeLocation {
  const filePath = stringField(location, "name");
  const startLine = nestedIntegerField(location, "startLoc", "line") ?? integerField(location, "start");
  const endLine = nestedIntegerField(location, "endLoc", "line") ?? integerField(location, "end");

  return {
    path: normalizeJscpdPath(filePath, cwd),
    startLine,
    endLine: endLine || startLine + Math.max(0, lineCount - 1),
    codeArea: "unknown"
  };
}

function integerField(record: Record<string, unknown>, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`jscpd field "${name}" must be a number`);
  }
  return Math.trunc(value);
}

function nestedIntegerField(record: Record<string, unknown>, parent: string, child: string): number | null {
  const parentValue = record[parent];
  if (!isNonArrayRecord(parentValue)) return null;
  const value = parentValue[child];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`jscpd field "${parent}.${child}" must be a number`);
  }
  return Math.trunc(value);
}

function stringField(record: Record<string, unknown>, name: string): string {
  const value = record[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`jscpd field "${name}" must be a non-empty string`);
  }
  return value;
}

function normalizeJscpdPath(filePath: string, cwd: string): string {
  const withoutExtendedPrefix = stripWindowsExtendedPathPrefix(filePath);
  const normalizedCwd = stripWindowsExtendedPathPrefix(cwd);
  const pathApi = pathApiForJscpdPath(withoutExtendedPrefix, normalizedCwd);

  if (!pathApi.isAbsolute(withoutExtendedPrefix)) {
    return toSlashPath(withoutExtendedPrefix);
  }

  const relativePath = pathApi.relative(normalizedCwd, withoutExtendedPrefix);
  if (relativePath === "") {
    return ".";
  }
  if (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath)) {
    return toSlashPath(relativePath);
  }
  return toSlashPath(withoutExtendedPrefix);
}

function stripWindowsExtendedPathPrefix(filePath: string): string {
  if (filePath.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${filePath.slice(8)}`;
  }
  if (filePath.startsWith("\\\\?\\")) {
    return filePath.slice(4);
  }
  return filePath;
}

function pathApiForJscpdPath(filePath: string, cwd: string): path.PlatformPath {
  return isWindowsAbsolutePath(filePath) || isWindowsAbsolutePath(cwd) ? path.win32 : path;
}

function isWindowsAbsolutePath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\");
}
