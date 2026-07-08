import type { WarningRecord } from "../../model/schema.ts";
import type { WarningCandidate } from "./warning-model.ts";

export function compareWarnings(a: WarningRecord, b: WarningRecord): number {
  const lvlOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const lvlDiff = lvlOrder[a.level] - lvlOrder[b.level];
  if (lvlDiff !== 0) return lvlDiff;
  return b.value - a.value;
}

export function shouldEmitChangedWarning(candidate: WarningCandidate): boolean {
  const { record, isWatchlistOnly, deltaFloor } = candidate;
  if (!record.isChanged) return false;
  if (isWatchlistOnly) return true;
  if (record.deltaValue === null || record.deltaValue === undefined) return true;
  return record.deltaValue > deltaFloor;
}

export function suppressesChangedWarnings(comparisonStatus: string): boolean {
  return comparisonStatus === "input-unchanged" || comparisonStatus === "baseline-unavailable";
}
