/**
 * Shared normalization helpers for quality scanner metric records.
 */

import { classifyFile, isExcluded } from "../model/code-areas.ts";
import type { FileMetric, FunctionMetric, QualityConfig, ToolAvailability } from "../model/schema.ts";

type NormalizeMetricOptions = {
  changedFiles?: readonly string[];
  config: QualityConfig;
};

export function normalizeFileMetrics(files: FileMetric[], options: NormalizeMetricOptions): FileMetric[] {
  return sortFileMetrics(
    files
      .map((file) => ({
        ...file,
        codeArea: classifyFile(file.path, options.config.codeAreas, options.config.generatedFiles),
        decisionTokens: { ...file.decisionTokens },
        isChanged: isInChangedScope(file.path, options.changedFiles)
      }))
      .filter((file) => !isExcluded(file.path, options.config.excludeDirs, options.config.generatedFiles))
  );
}

export function normalizeFunctionMetrics(
  functions: FunctionMetric[],
  options: NormalizeMetricOptions
): FunctionMetric[] {
  return sortFunctionMetrics(
    functions
      .map((func) => ({
        ...func,
        codeArea: classifyFile(func.file, options.config.codeAreas, options.config.generatedFiles),
        cyclomaticComplexity: { ...func.cyclomaticComplexity },
        isChanged: isInChangedScope(func.file, options.changedFiles)
      }))
      .filter((func) => !isExcluded(func.file, options.config.excludeDirs, options.config.generatedFiles))
  );
}

export function selectLizardTargetFiles(files: string[], config: QualityConfig): string[] {
  return files.filter(
    (file) => isLizardTarget(file) && !isExcluded(file, config.excludeDirs, config.generatedFiles)
  );
}

export function isToolAvailable(toolResults: ToolAvailability[], name: string): boolean {
  return toolResults.find((tool) => tool.name === name)?.available === true;
}

function sortFileMetrics(files: FileMetric[]): FileMetric[] {
  return files.slice().sort((a, b) => a.path.localeCompare(b.path));
}

function sortFunctionMetrics(functions: FunctionMetric[]): FunctionMetric[] {
  return functions.slice().sort((a, b) =>
    a.file.localeCompare(b.file) || a.startLine - b.startLine || a.name.localeCompare(b.name)
  );
}

function isLizardTarget(filePath: string): boolean {
  return filePath.endsWith(".rs") || filePath.endsWith(".ts");
}

function isInChangedScope(filePath: string, changedFiles: readonly string[] = []): boolean {
  return changedFiles.some((changedFile) => filePath.includes(changedFile) || changedFile.includes(filePath));
}
