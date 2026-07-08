import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  createEmptyMetrics,
  type QualityMetrics,
  type WarningRecord
} from "../../model/schema.ts";
import { changedFilesSection, warningsSection } from "./findings.ts";
import { fileDecisionTokenRankings, fileRankings, functionSizeRankings } from "./rankings.ts";
import { repositorySize } from "./summary.ts";

// @case AUX-QUALITY-REPORT-001
describe("quality report", () => {
  it("keeps changed-file watchlist useful without baseline annotations", () => {
    const metrics = qualityMetrics();
    metrics.comparisonStatus = "baseline-unavailable";
    metrics.fileMetrics = [
      qualityFile("src/risky.ts", { isChanged: true, lines: 480, decisionTokens: 45 }),
      qualityFile("src/quiet.ts", { isChanged: true, lines: 80, decisionTokens: 2 })
    ];
    metrics.warnings = {
      all: [warning("src/risky.ts", "scc-file-code-lines", 480)],
      changed: [],
      regressions: []
    };

    const section = changedFilesSection(metrics, 10);

    assert.match(section, /Changed files: 2 total, 1 shown by risk ranking/);
    assert.match(section, /src\/risky\.ts/);
    assert.doesNotMatch(section, /src\/quiet\.ts/);
  });

  it("sorts rankings by metric without mutating scanner output order", () => {
    const metrics = qualityMetrics();
    metrics.fileMetrics = [
      qualityFile("src/a-small.ts", { isChanged: false, lines: 10, decisionTokens: 1 }),
      qualityFile("src/b-large.ts", { isChanged: false, lines: 500, decisionTokens: 3 }),
      qualityFile("src/c-medium.ts", { isChanged: false, lines: 200, decisionTokens: 2 })
    ];
    metrics.functionMetrics = [
      qualityFunction("small", "src/a-small.ts", { lines: 5, complexity: 1 }),
      qualityFunction("large", "src/b-large.ts", { lines: 80, complexity: 3 }),
      qualityFunction("medium", "src/c-medium.ts", { lines: 40, complexity: 2 })
    ];
    const originalFileOrder = metrics.fileMetrics.map((file) => file.path);
    const originalFunctionOrder = metrics.functionMetrics.map((func) => func.name);

    const files = fileRankings(metrics, 2);
    const functions = functionSizeRankings(metrics, 2);

    assert.ok(files.indexOf("src/b-large.ts") < files.indexOf("src/c-medium.ts"));
    assert.doesNotMatch(files, /src\/a-small\.ts/);
    assert.ok(functions.indexOf("large") < functions.indexOf("medium"));
    assert.doesNotMatch(functions, /small/);
    assert.deepEqual(metrics.fileMetrics.map((file) => file.path), originalFileOrder);
    assert.deepEqual(metrics.functionMetrics.map((func) => func.name), originalFunctionOrder);
  });

  it("labels scc file Complexity as decision-token count and shows total-token share", () => {
    const metrics = qualityMetrics();
    metrics.fileMetrics = [
      qualityFile("src/dense.ts", { isChanged: false, lines: 80, codeLines: 50, decisionTokens: 10 }),
      qualityFile("src/sparse.ts", { isChanged: false, lines: 500, codeLines: 400, decisionTokens: 20 })
    ];

    const byLines = fileRankings(metrics, 1);
    const byDecisionTokens = fileDecisionTokenRankings(metrics, 2);

    assert.match(byLines, /Decision Tokens/);
    assert.doesNotMatch(byLines, /\bComplexity\b/);
    assert.match(byDecisionTokens, /scc decision tokens/);
    assert.match(byDecisionTokens, /file-decision-tokens \/ total-file-decision-tokens/);
    assert.match(byDecisionTokens, /src\/sparse\.ts/);
    assert.match(byDecisionTokens, /\|\s*66\.7%\s*\|/);
    assert.match(byDecisionTokens, /\|\s*33\.3%\s*\|/);
  });

  it("shows code-area decision-token hotspots by total-token share", () => {
    const metrics = qualityMetrics();
    metrics.aggregates = {
      ...metrics.aggregates,
      overall: {
        ...metrics.aggregates.overall,
        totalFileDecisionTokens: 40
      },
      byCodeArea: [
        codeAreaAggregate("typescript-production-scripts", { decisionTokens: 30, lines: 300 }),
        codeAreaAggregate("rust-production", { decisionTokens: 10, lines: 100 })
      ]
    };

    const section = repositorySize(metrics);

    assert.match(section, /Decision Tokens/);
    assert.match(section, /file-decision-tokens \/ total-file-decision-tokens/);
    assert.match(section, /typescript-production-scripts/);
    assert.match(section, /\|\s*30\s*\|\s*75\.0%\s*\|/);
    assert.match(section, /\|\s*10\s*\|\s*25\.0%\s*\|/);
  });

  it("shows accepted reasons next to warning records", () => {
    const metrics = qualityMetrics();
    const acceptedWarning = warning("crates/shared/protocol/src/envelope.rs", "jscpd-duplicate-code", 86);
    acceptedWarning.acceptedReason =
      "OperationArguments::operation and OperationResult::operation live at separate protocol request and result boundaries.";
    metrics.warnings = {
      all: [acceptedWarning],
      changed: [],
      regressions: []
    };

    const section = warningsSection(metrics);

    assert.match(section, /\*\*\[scc\] code-lines\*\*: test warning/);
    assert.match(section, /Accepted reason: OperationArguments::operation/);
  });
});

function qualityMetrics(): QualityMetrics {
  return createEmptyMetrics({
    repository: "/repo",
    commitSha: "test",
    configVersion: "quality-observability-v1",
    tools: [],
    scope: {
      include: [],
      excludeDirs: [],
      generatedFiles: []
    }
  });
}

function qualityFile(
  path: string,
  options: { codeLines?: number; decisionTokens: number; isChanged: boolean; lines: number }
): QualityMetrics["fileMetrics"][number] {
  return {
    path,
    language: "TypeScript",
    codeArea: "typescript-production-scripts",
    lines: options.lines,
    codeLines: options.codeLines ?? options.lines,
    decisionTokens: { value: options.decisionTokens, source: "scc" },
    isChanged: options.isChanged
  };
}

function qualityFunction(
  name: string,
  file: string,
  options: { complexity: number; lines: number }
): QualityMetrics["functionMetrics"][number] {
  return {
    name,
    file,
    codeArea: "typescript-production-scripts",
    startLine: 1,
    endLine: options.lines,
    lines: options.lines,
    parameterCount: 1,
    cyclomaticComplexity: { value: options.complexity, source: "lizard" },
    isChanged: false
  };
}

function codeAreaAggregate(
  codeArea: string,
  options: { decisionTokens: number; lines: number }
): QualityMetrics["aggregates"]["byCodeArea"][number] {
  return {
    codeArea,
    files: 1,
    lines: options.lines,
    codeLines: options.lines,
    fileDecisionTokens: options.decisionTokens,
    functions: 1,
    warningPolicy: "moderate"
  };
}

function warning(path: string, ruleId: string, value: number): WarningRecord {
  return {
    level: "warning",
    ruleId,
    sourceTool: "scc",
    path,
    line: null,
    codeArea: "typescript-production-scripts",
    metric: "code-lines",
    value,
    comparisonBasis: "changed-scope",
    baselineValue: null,
    deltaValue: null,
    isChanged: true,
    message: "test warning"
  };
}
