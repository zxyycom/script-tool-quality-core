import type { MetricWarningSpec, WarningCandidate } from "./warning-model.ts";

export function buildMetricWarning(spec: MetricWarningSpec): WarningCandidate | null {
  if (spec.value === null || !exceedsAbsoluteFloor(spec.value, spec.floor)) {
    return null;
  }

  return {
    deltaFloor: spec.deltaFloor,
    isWatchlistOnly: spec.areaPolicy.isWatchlistOnly,
    record: {
      level: spec.areaPolicy.level,
      ruleId: spec.ruleId,
      sourceTool: spec.sourceTool,
      path: spec.path,
      line: spec.line,
      codeArea: spec.codeArea,
      metric: spec.metric,
      value: spec.value,
      comparisonBasis: basisFor(spec.isChanged, spec.deltaValue),
      baselineValue: spec.baselineValue,
      deltaValue: spec.deltaValue,
      isChanged: spec.isChanged,
      message: spec.message,
      suggestion: spec.suggestion
    }
  };
}

export function deltaFrom(current: number | null | undefined, baseline: number | null | undefined): number | null {
  if (current === null || current === undefined || baseline === null || baseline === undefined) {
    return null;
  }
  return current - baseline;
}

function exceedsAbsoluteFloor(value: number | null | undefined, floor: number): boolean {
  return value !== null && value !== undefined && value > floor;
}

function basisFor(isChanged: boolean, delta: number | null): string {
  if (isChanged && delta !== null && delta !== undefined) {
    return "delta";
  }
  return isChanged ? "changed-scope" : "absolute";
}
