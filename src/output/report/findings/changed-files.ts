import { formatTable } from "../markdown-table.ts";
import type {
  DuplicateCodeFragment,
  FileMetric,
  QualityMetrics
} from "../../../model/schema.ts";

type RankedChangedFile = { file: FileMetric; reasons: string[]; score: number };
type ChangedFileRiskSignals = {
  changedWarningPaths: Set<string>;
  deltaWarningPaths: Set<string>;
  duplicatePaths: Set<string>;
};

export function changedFilesSection(metrics: QualityMetrics, topN = 10): string {
  const lines: string[] = [];
  lines.push("## Changed Files Watchlist");
  lines.push("");

  const changed = metrics.fileMetrics.filter((file) => file.isChanged);
  if (changed.length === 0) {
    lines.push("*(no changed files in scan scope)*");
    return lines.join("\n");
  }

  const ranked = rankChangedFilesByRisk(changed, metrics).slice(0, topN);
  lines.push(`Changed files: ${changed.length} total, ${ranked.length} shown by risk ranking`);

  if (ranked.length === 0) {
    lines.push("");
    lines.push("*(no changed files matched warning, delta, or duplicate-code risk criteria)*");
    return lines.join("\n");
  }

  lines.push("");
  appendChangedFilesTable(lines, ranked);

  return lines.join("\n");
}

function appendChangedFilesTable(lines: string[], ranked: RankedChangedFile[]): void {
  const rows = [["File", "Area", "Lines", "Decision Tokens", "Risk"]];
  for (const { file, reasons } of ranked) {
    rows.push([
      file.path,
      file.codeArea,
      file.lines.toLocaleString(),
      formatDecisionTokens(file),
      reasons.join(", ")
    ]);
  }
  lines.push(formatTable(rows));
}

function formatDecisionTokens(file: FileMetric): string {
  return file.decisionTokens.value !== null ? String(file.decisionTokens.value) : "n/a";
}

function rankChangedFilesByRisk(
  changed: FileMetric[],
  metrics: QualityMetrics
): RankedChangedFile[] {
  const signals = changedFileRiskSignals(metrics);

  return changed
    .map((file) => riskRankedFile(file, signals))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.file.lines - a.file.lines || a.file.path.localeCompare(b.file.path));
}

function changedFileRiskSignals(metrics: QualityMetrics): ChangedFileRiskSignals {
  const warnings = metrics.warnings?.all || [];
  return {
    changedWarningPaths: new Set(
      warnings
        .filter((warning) => warning.isChanged)
        .map((warning) => warning.path)
    ),
    deltaWarningPaths: new Set(
      warnings
        .filter((warning) => warning.isChanged && warning.deltaValue !== null && warning.deltaValue !== 0)
        .map((warning) => warning.path)
    ),
    duplicatePaths: changedDuplicatePaths(metrics.duplicateCode)
  };
}

function riskRankedFile(file: FileMetric, signals: ChangedFileRiskSignals): RankedChangedFile {
  const reasons: string[] = [];
  let score = 0;

  if (signals.changedWarningPaths.has(file.path)) {
    reasons.push("current warning");
    score += 4;
  }
  if (signals.deltaWarningPaths.has(file.path)) {
    reasons.push("delta");
    score += 2;
  }
  if (signals.duplicatePaths.has(file.path)) {
    reasons.push("duplicate code");
    score += 3;
  }

  return { file, reasons, score };
}

function changedDuplicatePaths(duplicates: DuplicateCodeFragment[]): Set<string> {
  const paths = new Set<string>();
  for (const duplicate of duplicates) {
    if (!duplicate.hitsChangedScope) continue;
    for (const location of duplicate.locations) {
      paths.add(location.path);
    }
  }
  return paths;
}
