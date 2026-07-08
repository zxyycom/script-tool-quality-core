import { formatTable } from "../markdown-table.ts";
import type { AggregateMetrics, QualityMetrics } from "../../../model/schema.ts";

export function fingerprintTable(metrics: QualityMetrics): string {
  const rows = [["Code Area", "Current Files", "Baseline Files", "Match"]];
  const current = metrics.currentFingerprints || {};
  const baseline = metrics.baselineFingerprints || {};

  for (const area of Object.keys({ ...current, ...baseline })) {
    const currentFingerprint = current[area];
    const baselineFingerprint = baseline[area];
    const currentCount = currentFingerprint?.fileCount ?? 0;
    const baselineCount = baselineFingerprint?.fileCount ?? 0;
    const match = currentFingerprint?.fingerprint === baselineFingerprint?.fingerprint ? "✓" : "✗ changed";

    rows.push([area, String(currentCount), String(baselineCount), match]);
  }

  return formatTable(rows);
}

export function appendLanguageTable(lines: string[], agg: AggregateMetrics): void {
  if (agg.byLanguage.length === 0) return;

  lines.push("### By Language");
  lines.push("");
  const rows = [["Language", "Files", "Lines", "Code", "Comments", "Blanks"]];
  for (const lang of agg.byLanguage) {
    rows.push([
      lang.language,
      String(lang.files),
      lang.lines.toLocaleString(),
      lang.codeLines.toLocaleString(),
      lang.commentLines.toLocaleString(),
      lang.blankLines.toLocaleString()
    ]);
  }
  lines.push(formatTable(rows));
}

export function appendCodeAreaTable(lines: string[], agg: AggregateMetrics): void {
  if (agg.byCodeArea.length === 0) return;

  lines.push("");
  lines.push("### By Code Area");
  lines.push("");
  const totalDecisionTokens = totalCodeAreaDecisionTokens(agg);
  const rows = [
    [
      "Code Area",
      "Files",
      "Lines",
      "Functions",
      "Decision Tokens",
      "file-decision-tokens / total-file-decision-tokens",
      "Policy"
    ]
  ];
  for (const area of agg.byCodeArea) {
    rows.push([
      area.codeArea,
      String(area.files),
      area.lines.toLocaleString(),
      String(area.functions || 0),
      String(area.fileDecisionTokens ?? 0),
      formatDecisionTokenShare(area.fileDecisionTokens, totalDecisionTokens),
      area.warningPolicy
    ]);
  }
  lines.push(formatTable(rows));
}

function totalCodeAreaDecisionTokens(agg: AggregateMetrics): number {
  const aggregateTotal = agg.overall.totalFileDecisionTokens;
  if (aggregateTotal !== undefined && aggregateTotal > 0) return aggregateTotal;
  return agg.byCodeArea.reduce((total, area) => total + (area.fileDecisionTokens ?? 0), 0);
}

function formatDecisionTokenShare(decisionTokens: number | null | undefined, totalDecisionTokens: number): string {
  if (decisionTokens === null || decisionTokens === undefined || totalDecisionTokens <= 0) return "n/a";
  return `${((decisionTokens / totalDecisionTokens) * 100).toFixed(1)}%`;
}
