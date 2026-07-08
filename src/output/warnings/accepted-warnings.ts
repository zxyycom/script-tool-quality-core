import type {
  AcceptedWarningConfig,
  WarningChannels,
  WarningRecord
} from "../../model/schema.ts";

export function applyAcceptedWarningReasons(
  warnings: WarningChannels,
  acceptedWarnings: readonly AcceptedWarningConfig[],
  { warnOnUnmatched }: { warnOnUnmatched: boolean }
): WarningChannels {
  const matchedAcceptances = new Set<AcceptedWarningConfig>();

  for (const warning of warnings.all) {
    const acceptance = acceptedWarnings.find((candidate) => warningMatchesAcceptance(warning, candidate));
    if (acceptance) {
      matchedAcceptances.add(acceptance);
      warning.acceptedReason = acceptance.reason;
    }
  }

  if (warnOnUnmatched) {
    for (const acceptance of acceptedWarnings) {
      if (!matchedAcceptances.has(acceptance)) {
        warnings.all.push(unmatchedAcceptedWarning(acceptance));
      }
    }
  }

  return warnings;
}

function warningMatchesAcceptance(warning: WarningRecord, acceptance: AcceptedWarningConfig): boolean {
  const scalarMatches = [
    warning.ruleId === acceptance.ruleId,
    optionalMatch(acceptance.sourceTool, warning.sourceTool),
    optionalMatch(acceptance.path, warning.path),
    optionalMatch(acceptance.codeArea, warning.codeArea),
    optionalMatch(acceptance.metric, warning.metric),
    optionalMatch(acceptance.value, warning.value)
  ];

  return scalarMatches.every(Boolean) && textFieldsMatch(warning, acceptance);
}

function optionalMatch<T>(expected: T | undefined, actual: T): boolean {
  return expected === undefined || expected === actual;
}

function includesAll(value: string, expectedFragments: readonly string[]): boolean {
  return expectedFragments.every((fragment) => value.includes(fragment));
}

function textFieldsMatch(warning: WarningRecord, acceptance: AcceptedWarningConfig): boolean {
  return (
    includesAll(warning.message, acceptance.messageIncludes ?? []) &&
    includesAll(warning.suggestion ?? "", acceptance.suggestionIncludes ?? [])
  );
}

function unmatchedAcceptedWarning(acceptance: AcceptedWarningConfig): WarningRecord {
  return {
    level: "warning",
    ruleId: "quality-accepted-warning-unmatched",
    sourceTool: "quality",
    path: "quality-config",
    line: null,
    codeArea: "quality-config",
    metric: "accepted-warning-match",
    value: 1,
    comparisonBasis: "configuration",
    baselineValue: null,
    deltaValue: null,
    isChanged: false,
    message: `Accepted warning rule did not match any generated warning (${formatAcceptanceLabel(acceptance)})`,
    suggestion: "Review or remove this acceptedWarnings entry. If the underlying warning disappeared, remove the acceptance; if the warning shape changed, update the matching fields."
  };
}

function formatAcceptanceLabel(acceptance: AcceptedWarningConfig): string {
  const parts = [
    `ruleId=${acceptance.ruleId}`,
    acceptance.sourceTool ? `sourceTool=${acceptance.sourceTool}` : null,
    acceptance.metric ? `metric=${acceptance.metric}` : null,
    acceptance.value === undefined ? null : `value=${acceptance.value}`,
    acceptance.codeArea ? `codeArea=${acceptance.codeArea}` : null,
    acceptance.path ? `path=${acceptance.path}` : null
  ];
  return parts.filter((part): part is string => part !== null).join(", ");
}
