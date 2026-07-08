/**
 * 文件分类和 code area 归类。
 *
 * 根据配置文件中的 glob 规则将文件归类到 6 类默认 code areas。
 * 同时负责路径过滤和 generated files 识别。
 */

import { minimatch } from "minimatch";
import { createHash } from "node:crypto";
import type { CodeAreaDefinition, CodeAreaFileMap, CodeAreaFingerprint } from "./schema.ts";

/**
 * 将文件路径归类到配置定义的 code area。
 *
 * 匹配优先级：
 * 1. generated files（最高优先）
 * 2. 按配置的 code areas 顺序匹配 globs
 * 3. 未匹配的文件归入 "unknown" code area
 */
export function classifyFile(
  filePath: string,
  codeAreas: Record<string, CodeAreaDefinition>,
  generatedFileGlobs: readonly string[]
): string {
  if (generatedFileGlobs.some((g) => minimatch(filePath, g))) {
    return "generated";
  }

  for (const [name, def] of Object.entries(codeAreas)) {
    if (name === "generated") continue;

    if (def.excludeGlobs.some((g) => minimatch(filePath, g))) {
      continue;
    }
    if (def.globs.some((g) => minimatch(filePath, g))) {
      return name;
    }
  }

  return "unknown";
}

export function isExcluded(filePath: string, excludeDirs: readonly string[], generatedFileGlobs: readonly string[]): boolean {
  const parts = filePath.split("/");

  if (excludeDirs.some((d) => parts.includes(d))) {
    return true;
  }

  if (generatedFileGlobs.some((g) => minimatch(filePath, g))) {
    return true;
  }

  return false;
}

export function classifyFiles(
  files: readonly string[],
  codeAreas: Record<string, CodeAreaDefinition>,
  generatedFileGlobs: readonly string[]
): CodeAreaFileMap {
  const groups: CodeAreaFileMap = new Map();

  for (const file of files) {
    const area = classifyFile(file, codeAreas, generatedFileGlobs);
    if (!groups.has(area)) {
      groups.set(area, []);
    }
    groups.get(area)?.push(file);
  }

  for (const files of groups.values()) {
    files.sort();
  }

  return groups;
}

export function buildFingerprint(
  _codeArea: string,
  files: readonly string[],
  gitHashFn: (filePath: string) => string
): CodeAreaFingerprint {
  const sortedFiles = files.slice().sort();
  const inputDigest = createHash("sha256");

  for (const file of sortedFiles) {
    inputDigest.update(file, "utf8");
    inputDigest.update("\0");
    inputDigest.update(gitHashFn(file), "utf8");
    inputDigest.update("\n");
  }

  return {
    fileCount: files.length,
    fileList: sortedFiles.slice(0, 200),
    fingerprint: `sha256:${inputDigest.digest("hex")}:${files.length}`
  };
}
