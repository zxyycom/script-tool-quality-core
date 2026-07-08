import type {
  AggregateMetrics,
  DuplicateCodeFragment,
  FileMetric,
  FunctionMetric
} from "../../model/schema.ts";

export function buildOverallAggregates({
  fileMetrics,
  functionMetrics,
  duplicateCode
}: {
  duplicateCode: DuplicateCodeFragment[];
  fileMetrics: FileMetric[];
  functionMetrics: FunctionMetric[];
}): AggregateMetrics["overall"] {
  return {
    totalFiles: fileMetrics.length,
    totalLines: sum(fileMetrics, (file) => file.lines || 0),
    totalCodeLines: sum(fileMetrics, (file) => file.codeLines || 0),
    totalFileDecisionTokens: sum(fileMetrics, (file) => file.decisionTokens?.value ?? 0),
    totalFunctions: functionMetrics.length,
    totalFunctionLines: sum(functionMetrics, (func) => func.lines || 0),
    totalFunctionParameters: sum(functionMetrics, (func) => func.parameterCount || 0),
    totalFunctionCyclomaticComplexity: sum(
      functionMetrics,
      (func) => func.cyclomaticComplexity?.value ?? 0
    ),
    totalDuplicateFragments: duplicateCode.length
  };
}

function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((total, item) => total + selector(item), 0);
}
