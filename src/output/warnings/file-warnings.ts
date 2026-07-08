import type { FileMetric, QualityConfig } from "../../model/schema.ts";
import { metricAreaWarningPolicy } from "./area-policy.ts";
import { buildMetricWarning, deltaFrom } from "./metric-warning.ts";
import type { AreaWarningPolicy, WarningCandidate, WarningContext } from "./warning-model.ts";

type FileWarningInput = {
  areaPolicy: AreaWarningPolicy;
  baseFile: FileMetric | undefined;
  context: WarningContext;
  file: FileMetric;
};

type FileWarningBuilder = (input: FileWarningInput) => WarningCandidate | null;

const FILE_WARNING_BUILDERS: FileWarningBuilder[] = [buildFileLineWarning];

export function generateFileWarnings(files: FileMetric[], context: WarningContext): WarningCandidate[] {
  const warnings: WarningCandidate[] = [];

  for (const file of files) {
    const areaPolicy = metricAreaWarningPolicy(context.config, file.codeArea);
    if (!areaPolicy) continue;

    const baseFile = context.baselineFiles.get(file.path);
    const warningInput = { areaPolicy, baseFile, context, file };
    for (const buildWarning of FILE_WARNING_BUILDERS) {
      const warning = buildWarning(warningInput);
      if (warning) warnings.push(warning);
    }
  }

  return warnings;
}

function buildFileLineWarning(input: FileWarningInput): WarningCandidate | null {
  const { areaPolicy, baseFile, context, file } = input;
  const lineFloor = fileCodeLineFloor(file, context.config);
  const lineDelta = context.config.scc?.fileCodeLines?.changedDelta ?? 100;
  const fileCodeLines = file.codeLines ?? null;
  const baselineCodeLines = baselineFileCodeLines(baseFile, context.hasBaselineFiles);
  const lineDeltaValue = deltaFrom(fileCodeLines, baselineCodeLines);

  return buildMetricWarning({
    areaPolicy,
    baselineValue: baselineCodeLines,
    codeArea: file.codeArea,
    deltaFloor: lineDelta,
    deltaValue: lineDeltaValue,
    floor: lineFloor,
    isChanged: file.isChanged,
    line: null,
    message: `File "${file.path}" has ${fileCodeLines} code lines (threshold: ${lineFloor} code lines)`,
    metric: "code-lines",
    path: file.path,
    ruleId: "scc-file-code-lines",
    sourceTool: "scc",
    suggestion: fileLineSuggestion(fileCodeLines, lineFloor),
    value: fileCodeLines
  });
}

function fileCodeLineFloor(file: FileMetric, config: QualityConfig): number {
  const threshold = config.scc.fileCodeLines;
  const allowance = threshold.lowDecisionTokenAllowance;
  const decisionTokens = file.decisionTokens.value;

  if (decisionTokens !== null && decisionTokens <= allowance.maxDecisionTokens) {
    return allowance.codeLineFloor;
  }
  return threshold.absoluteFloor;
}

function baselineFileCodeLines(
  baseFile: FileMetric | undefined,
  hasBaselineFiles: boolean
): number | null {
  if (baseFile) {
    return baseFile.codeLines ?? null;
  }
  return hasBaselineFiles ? 0 : null;
}

function fileLineSuggestion(codeLines: number | null, floor: number): string {
  if (codeLines !== null && codeLines > floor * 3) {
    return "Review ownership, responsibilities, and change reasons before refactoring";
  }
  return "Review file responsibility before refactoring";
}
