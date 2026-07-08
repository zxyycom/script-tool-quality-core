import type { AggregateMetrics, CodeAreaAggregate, TrendDelta } from "../../model/schema.ts";

export const overallTrendSpecs: Array<[string, keyof AggregateMetrics["overall"], string]> = [
  ["total-files", "totalFiles", "files"],
  ["total-lines", "totalLines", "lines"],
  ["total-code-lines", "totalCodeLines", "lines"],
  ["total-file-decision-tokens", "totalFileDecisionTokens", "decision-tokens"],
  ["total-functions", "totalFunctions", "functions"],
  ["total-function-lines", "totalFunctionLines", "lines"],
  ["total-function-parameters", "totalFunctionParameters", "parameters"],
  ["total-function-cyclomatic-complexity", "totalFunctionCyclomaticComplexity", "complexity"],
  ["duplicate-fragments", "totalDuplicateFragments", "fragments"]
];

export const codeAreaTrendSpecs: Array<[string, keyof CodeAreaAggregate, string]> = [
  ["files", "files", "files"],
  ["lines", "lines", "lines"],
  ["code-lines", "codeLines", "lines"],
  ["file-decision-tokens", "fileDecisionTokens", "decision-tokens"],
  ["functions", "functions", "functions"],
  ["function-lines", "functionLines", "lines"],
  ["function-parameters", "parameterCount", "parameters"],
  ["function-cyclomatic-complexity", "cyclomaticComplexity", "complexity"],
  ["duplicate-fragments", "duplicateFragments", "fragments"]
];

export function makeTrend(metric: string, current: number | null, baseline: number | null, unit: string): TrendDelta {
  const delta = (current !== null && baseline !== null) ? current - baseline : null;
  const percentChange = (delta !== null && baseline !== null && baseline !== 0)
    ? Math.round((delta / baseline) * 1000) / 10
    : null;

  return { metric, current, baseline, delta, percentChange, unit };
}

export function percentOf(value: number, total: number): number | null {
  if (!total) return null;
  return Math.round((value / total) * 1000) / 10;
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
