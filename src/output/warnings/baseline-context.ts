import type {
  DuplicateCodeFragment,
  FileMetric,
  FunctionMetric,
  QualityConfig
} from "../../model/schema.ts";
import type { WarningBaseline, WarningContext } from "./warning-model.ts";

export function buildWarningContext(config: QualityConfig, baseline: WarningBaseline): WarningContext {
  const baselineFiles = buildFileBaselineMap(baseline?.files || []);
  const baselineFunctions = buildFunctionBaselineMap(baseline?.functions || []);
  const baselineDuplicateIndex = buildDuplicateBaselineIndex(baseline?.duplicates || []);
  const hasBaselineFiles = Array.isArray(baseline?.files);
  const hasBaselineFunctions = Array.isArray(baseline?.functions);
  const hasBaselineDuplicates = Array.isArray(baseline?.duplicates);

  return {
    baselineDuplicateIndex,
    baselineFiles,
    baselineFunctions,
    config,
    hasBaselineDuplicates,
    hasBaselineFiles,
    hasBaselineFunctions
  };
}

export function functionKey(func: FunctionMetric): string {
  return `${func.file}:${func.name}:${func.startLine}`;
}

export function countMatchingBaselineDuplicates(
  dup: DuplicateCodeFragment,
  baselineIndex: Map<string, number>,
  hasBaselineDuplicates: boolean
): number | null {
  if (!hasBaselineDuplicates) {
    return null;
  }
  return baselineIndex.get(duplicateKey(dup)) || 0;
}

function buildFileBaselineMap(files: FileMetric[]): Map<string, FileMetric> {
  return new Map(files.map((file) => [file.path, file]));
}

function buildFunctionBaselineMap(functions: FunctionMetric[]): Map<string, FunctionMetric> {
  return new Map(functions.map((func) => [functionKey(func), func]));
}

function buildDuplicateBaselineIndex(duplicates: DuplicateCodeFragment[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const dup of duplicates) {
    const key = duplicateKey(dup);
    index.set(key, (index.get(key) || 0) + 1);
  }
  return index;
}

function duplicateKey(dup: DuplicateCodeFragment): string {
  return dup.locations
    .map((loc) => `${loc.path}:${loc.startLine}`)
    .sort()
    .join("|");
}
