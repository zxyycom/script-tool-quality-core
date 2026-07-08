import type { BaselineStatus, QualityMetrics } from "../../../model/schema.ts";
import { formatCommitDisplay, formatReportTimestamp, type ReportOptions } from "./formatting.ts";
import {
  appendCodeAreaTable,
  appendLanguageTable,
  fingerprintTable
} from "./tables.ts";

export function title(options: ReportOptions) {
  return [
    `# ${options.title}`,
    "",
    `**${options.nonBlockingNotice}**`
  ].join("\n");
}

type ComparisonSectionRenderer = (metrics: QualityMetrics) => string;

const comparisonSectionRenderers: Partial<Record<string, ComparisonSectionRenderer>> = {
  "input-unchanged": () => inputUnchangedComparisonSection(),
  "baseline-unavailable": (metrics) => baselineUnavailableComparisonSection(metrics.baseline.status),
  compared: (metrics) => (metrics.baseline.metadata ? comparedComparisonSection(metrics) : "")
};

const baselineUnavailableReasons: Partial<Record<string, string>> = {
  "baseline-skipped": "Baseline scan was skipped",
  "history-unavailable": "Git history 不足",
  "no-baseline-commit": "找不到 previous-code baseline commit",
  "baseline-materialization-failed": "Baseline commit 导出失败",
  "baseline-scan-failed": "Baseline 扫描失败"
};

export function scanInfo(metrics: QualityMetrics, options: ReportOptions): string {
  const m = metrics.metadata;
  const tools = m.tools.map((tool) => `- **${tool.name}**: ${tool.version} (via ${tool.source})`).join("\n");
  const timestamp = formatReportTimestamp(m.timestamp, options?.timeZone);
  return [
    "## 扫描信息",
    "",
    `- **Schema version**: ${m.schemaVersion}`,
    `- **Timestamp**: ${timestamp}`,
    `- **Commit**: ${formatCommitDisplay(m.commitSha, m.commitTitle)}`,
    `- **Config version**: ${m.configVersion}`,
    `- **Scope**: ${m.scope.include.join(", ")}`,
    "",
    "### 工具",
    tools,
    "",
    `- **Baseline status**: \`${metrics.baseline.status}\``,
    `- **Comparison status**: \`${metrics.comparisonStatus}\``
  ].join("\n");
}

export function comparisonInfo(metrics: QualityMetrics): string {
  return comparisonSectionRenderers[metrics.comparisonStatus]?.(metrics) ?? "";
}

function inputUnchangedComparisonSection(): string {
  return [
    "## Comparison",
    "",
    "**代码输入未变化。** 本次变更未修改任何纳入扫描的代码文件。",
    "当前快照已生成，但不生成动态质量指标或重复代码 annotation。"
  ].join("\n");
}

function baselineUnavailableComparisonSection(status: BaselineStatus | string): string {
  const reason = baselineUnavailableReason(status);
  return [
    "## Comparison",
    "",
    `**⚠️ Baseline 不可用:** ${reason} (\`${status}\`)。`,
    "Baseline delta 不可用，报告仅展示当前快照。"
  ].join("\n");
}

function comparedComparisonSection(metrics: QualityMetrics): string {
  const baseline = metrics.baseline;
  const baselineMetadata = metrics.baseline.metadata;
  if (!baselineMetadata) {
    return "";
  }

  return [
    "## Comparison",
    "",
    `- **Baseline commit**: ${formatCommitDisplay(baseline.commitSha || "unknown", baselineMetadata.commitTitle)}`,
    `- **Baseline date**: ${baseline.commitDate || "unknown"}`,
    `- **Selection reason**: ${baselineMetadata.selectionReason}`,
    "",
    "### Code Area 指纹对比",
    "",
    fingerprintTable(metrics)
  ].join("\n");
}

export function repositorySize(metrics: QualityMetrics): string {
  const agg = metrics.aggregates;
  const lines: string[] = [];

  lines.push("## 仓库体量与语言占比");
  lines.push("");

  if (agg.overall.totalFiles > 0) {
    lines.push(`- **Total files**: ${agg.overall.totalFiles}`);
    lines.push(`- **Total lines**: ${agg.overall.totalLines.toLocaleString()}`);
    lines.push(`- **Total code lines**: ${agg.overall.totalCodeLines.toLocaleString()}`);
    lines.push(`- **Total functions**: ${agg.overall.totalFunctions}`);
  } else {
    lines.push("*(no file metrics available)*");
  }

  lines.push("");

  appendLanguageTable(lines, agg);
  appendCodeAreaTable(lines, agg);

  return lines.join("\n");
}

export function footer(metrics: QualityMetrics, options: ReportOptions): string {
  const timestamp = formatReportTimestamp(metrics.metadata.timestamp, options?.timeZone);
  return [
    "---",
    "",
    `*Report generated at ${timestamp} by ${options.footerGeneratedBy}*`,
    "",
    `*Config version: ${metrics.metadata.configVersion} | Schema version: ${metrics.metadata.schemaVersion}*`,
    "",
    `*${options.footerNotice}*`
  ].join("\n");
}

function baselineUnavailableReason(status: BaselineStatus | string): string {
  return baselineUnavailableReasons[status] ?? "未知原因";
}
