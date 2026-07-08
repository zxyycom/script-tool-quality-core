import type { DuplicateCodeFragment } from "../../model/schema.ts";
import { duplicateAreaWarningPolicy } from "./area-policy.ts";
import { countMatchingBaselineDuplicates } from "./baseline-context.ts";
import { buildMetricWarning } from "./metric-warning.ts";
import type { AreaWarningPolicy, WarningCandidate, WarningContext } from "./warning-model.ts";

type DuplicateWarningInput = {
  areaPolicy: AreaWarningPolicy;
  context: WarningContext;
  dup: DuplicateCodeFragment;
  uniqueAreas: string[];
};

export function generateDuplicateWarnings(duplicates: DuplicateCodeFragment[], context: WarningContext): WarningCandidate[] {
  const warnings: WarningCandidate[] = [];

  for (const dup of duplicates) {
    const uniqueAreas = duplicateCodeAreas(dup);
    const areaPolicy = duplicateAreaWarningPolicy(uniqueAreas, context.config);
    if (!areaPolicy) continue;

    const warning = buildDuplicateWarning({ areaPolicy, context, dup, uniqueAreas });
    if (warning) warnings.push(warning);
  }

  return warnings;
}

function buildDuplicateWarning(input: DuplicateWarningInput): WarningCandidate | null {
  const { areaPolicy, context, dup, uniqueAreas } = input;
  const primaryLocation = dup.locations[0];
  const baselineDuplicateCount = countMatchingBaselineDuplicates(
    dup,
    context.baselineDuplicateIndex,
    context.hasBaselineDuplicates
  );
  const duplicateDelta = baselineDuplicateCount === null ? null : 1 - baselineDuplicateCount;
  const duplicateDeltaFloor = context.config.jscpd?.duplicateFragments?.changedDelta ?? 0;
  const locations = dup.locations.map(formatDuplicateWarningLocation).join(", ");

  return buildMetricWarning({
    areaPolicy,
    baselineValue: baselineDuplicateCount,
    codeArea: uniqueAreas.join(",") || "unknown",
    deltaFloor: duplicateDeltaFloor,
    deltaValue: duplicateDelta,
    floor: 0,
    isChanged: dup.hitsChangedScope,
    line: primaryLocation?.startLine ?? null,
    message: `Duplicate code fragment (${dup.tokenCount} tokens) across ${dup.locations.length} locations in areas [${uniqueAreas.join(", ")}]`,
    metric: "duplicate-tokens",
    path: primaryLocation?.path || "unknown",
    ruleId: "jscpd-duplicate-code",
    sourceTool: "jscpd",
    suggestion: `Consider extracting shared code into a common function or module. Locations: ${locations}`,
    value: dup.tokenCount
  });
}

function duplicateCodeAreas(dup: DuplicateCodeFragment): string[] {
  const involvedAreas = dup.locations.map((location) => location.codeArea).filter(Boolean);
  return [...new Set(involvedAreas)] as string[];
}

function formatDuplicateWarningLocation(location: DuplicateCodeFragment["locations"][number]): string {
  return `${location.path}:${location.startLine}`;
}
