import type { QualityMetrics, WarningRecord } from "../../../model/schema.ts";

const WARNING_RECORDS_PER_SECTION = 10;

interface WarningGroups {
  all: WarningRecord[];
  changed: WarningRecord[];
  regressions: WarningRecord[];
}

type WarningLevelSection = {
  icon: string;
  label: string;
  level: string;
};

const WARNING_LEVEL_SECTIONS: WarningLevelSection[] = [
  { level: "error", icon: "🔴", label: "ERROR" },
  { level: "warning", icon: "🟡", label: "WARNING" },
  { level: "info", icon: "ℹ️", label: "INFO" }
];

export function warningsSection(metrics: QualityMetrics): string {
  const lines: string[] = [];
  lines.push("## Warnings");
  lines.push("");

  const warnings = collectWarningGroups(metrics);
  if (warnings.all.length === 0) {
    lines.push("*(no warnings generated)*");
    return lines.join("\n");
  }

  appendWarningTotals(lines, warnings);
  appendWarningsByLevel(lines, warnings.all, "All Warnings Summary");
  appendChangedWarningsSection(lines, warnings.changed);

  return lines.join("\n");
}

function collectWarningGroups(metrics: QualityMetrics): WarningGroups {
  return {
    all: metrics.warnings?.all || [],
    changed: metrics.warnings?.changed || [],
    regressions: metrics.warnings?.regressions || []
  };
}

function appendWarningTotals(lines: string[], warnings: WarningGroups): void {
  lines.push(
    `**All warnings**: ${warnings.all.length} total ` +
    `(${warnings.changed.length} changed, ${warnings.regressions.length} regressions)`
  );
  lines.push("");
}

function appendChangedWarningsSection(lines: string[], changedWarnings: WarningRecord[]): void {
  lines.push("### Changed Warnings");
  lines.push("");
  if (changedWarnings.length === 0) {
    lines.push("*(no changed warnings for CI annotation)*");
    return;
  }

  appendWarningList(lines, changedWarnings.slice(0, WARNING_RECORDS_PER_SECTION));
  appendRemainingCount(lines, changedWarnings.length, WARNING_RECORDS_PER_SECTION, "changed warnings");
}

function appendWarningsByLevel(lines: string[], warnings: WarningRecord[], title: string): void {
  lines.push(`### ${title}`);
  lines.push("");
  if (warnings.length === 0) {
    lines.push("*(no warnings)*");
    lines.push("");
    return;
  }

  for (const section of WARNING_LEVEL_SECTIONS) {
    const levelWarnings = warnings.filter((warning) => warning.level === section.level);
    if (levelWarnings.length === 0) continue;

    lines.push(`#### ${section.icon} ${section.label} (${levelWarnings.length})`);
    lines.push("");
    appendWarningList(lines, levelWarnings.slice(0, WARNING_RECORDS_PER_SECTION));
    appendRemainingCount(lines, levelWarnings.length, WARNING_RECORDS_PER_SECTION, `${section.level} records`);
    lines.push("");
  }
}

function appendWarningList(lines: string[], warnings: WarningRecord[]): void {
  for (const warning of warnings) {
    lines.push(`- **[${warning.sourceTool}] ${warning.metric}**: ${warning.message}`);
    if (warning.acceptedReason) {
      lines.push(`  → Accepted reason: ${warning.acceptedReason}`);
    }
    if (warning.suggestion) {
      lines.push(`  → ${warning.suggestion}`);
    }
  }
}

function appendRemainingCount(lines: string[], total: number, shown: number, label: string): void {
  if (total > shown) {
    lines.push(`- *... and ${total - shown} more ${label}*`);
  }
}
