import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

import type { AcceptedWarningConfig, DuplicateCodeFragment, FileMetric, FunctionMetric, QualityConfig } from "../../model/schema.ts";
import { generateWarningChannels } from "./generator.ts";
import { TEST_QUALITY_CONFIG } from "../../../test/config.ts";

// @case AUX-QUALITY-WARNINGS-001
describe("quality warning generation", () => {
  it("uses scc code lines and low decision-token allowance for file-size warnings", () => {
    const files = [
      qualityFile("scripts/comment-heavy.ts", { lines: 420, codeLines: 120 }),
      qualityFile("scripts/low-token-config.ts", {
        lines: 540,
        codeLines: 500,
        decisionTokens: 10
      }),
      qualityFile("scripts/high-token-module.ts", {
        lines: 540,
        codeLines: 500,
        decisionTokens: 11
      })
    ];

    const warnings = generateWarningChannels({
      baseline: null,
      comparisonStatus: "baseline-unavailable",
      config: TEST_QUALITY_CONFIG,
      duplicates: [],
      files,
      functions: [],
      scope: { changed: false, changedFiles: [] }
    });

    assert.deepEqual(
      warnings.all.map((warning) => [warning.ruleId, warning.path, warning.metric, warning.value]),
      [["scc-file-code-lines", "scripts/high-token-module.ts", "code-lines", 500]]
    );
    assert.match(warnings.all[0]!.message, /500 code lines/);
    assert.match(warnings.all[0]!.message, /threshold: 300 code lines/);
    assert.match(warnings.all[0]!.suggestion ?? "", /responsibility/);
  });

  it("uses complexity-aware function code density thresholds", () => {
    const functions = [
      qualityFunction("simpleLongEnough.ts", { complexity: 4, lines: 120 }),
      qualityFunction("simpleTooLong.ts", { complexity: 4, lines: 151 }),
      qualityFunction("normalTooLong.ts", { complexity: 5, lines: 51 })
    ];

    const warnings = generateWarningChannels({
      baseline: null,
      comparisonStatus: "baseline-unavailable",
      config: TEST_QUALITY_CONFIG,
      duplicates: [],
      files: [],
      functions,
      scope: { changed: false, changedFiles: [] }
    });

    assert.deepEqual(
      warnings.all.map((warning) => [warning.ruleId, warning.path, warning.metric, warning.value]),
      [
        ["lizard-function-code-density", "simpleTooLong.ts", "function-code-density", 151],
        ["lizard-function-code-density", "normalTooLong.ts", "function-code-density", 51]
      ]
    );
    assert.match(warnings.all[0]!.message, /151 code lines at cyclomatic complexity 4/);
    assert.match(warnings.all[0]!.message, /threshold: 150 code lines for CC < 5/);
    assert.match(warnings.all[1]!.message, /threshold: 50 code lines/);
  });

  it("adds configured accepted reasons without relying on duplicate line numbers", () => {
    const warnings = generateWarningChannels({
      baseline: null,
      comparisonStatus: "baseline-unavailable",
      config: configWithAcceptedWarnings([acceptedProtocolOperationDuplicateAcceptance()]),
      duplicates: [acceptedProtocolOperationDuplicate({ startLineOffset: 20 })],
      files: [],
      functions: [],
      scope: { changed: false, changedFiles: [] }
    });

    assert.equal(warnings.all.length, 1);
    assert.match(warnings.all[0]!.acceptedReason ?? "", /separate protocol request and result boundaries/);
    assert.deepEqual(warnings.changed, []);
    assert.deepEqual(warnings.regressions, []);
  });

  it("warns when an accepted warning rule no longer matches any generated warning", () => {
    const warnings = generateWarningChannels({
      baseline: null,
      comparisonStatus: "baseline-unavailable",
      config: configWithAcceptedWarnings([
        {
          ruleId: "jscpd-duplicate-code",
          sourceTool: "jscpd",
          metric: "duplicate-tokens",
          value: 999,
          reason: "stale acceptance for test"
        }
      ]),
      duplicates: [acceptedProtocolOperationDuplicate()],
      files: [],
      functions: [],
      scope: { changed: false, changedFiles: [] },
      validateAcceptedWarnings: true
    });

    const unmatched = warnings.all.find((warning) => warning.ruleId === "quality-accepted-warning-unmatched");

    assert.ok(unmatched);
    assert.match(unmatched.message, /value=999/);
    assert.equal(unmatched.acceptedReason, undefined);
  });
});

function qualityFile(
  path: string,
  options: { codeLines: number; decisionTokens?: number; lines: number }
): FileMetric {
  return {
    path,
    language: "TypeScript",
    codeArea: "typescript-production-scripts",
    lines: options.lines,
    codeLines: options.codeLines,
    decisionTokens: { value: options.decisionTokens ?? 1, source: "scc" },
    isChanged: false
  };
}

function qualityFunction(
  path: string,
  options: { complexity: number; lines: number }
): FunctionMetric {
  return {
    file: path,
    name: "example",
    codeArea: "typescript-production-scripts",
    startLine: 1,
    endLine: options.lines,
    lines: options.lines,
    parameterCount: 1,
    cyclomaticComplexity: { value: options.complexity, source: "lizard" },
    isChanged: false
  };
}

function acceptedProtocolOperationDuplicate({
  startLineOffset = 0
}: {
  startLineOffset?: number;
} = {}): DuplicateCodeFragment {
  return {
    id: 1,
    tokenCount: 86,
    lineCount: 14,
    hitsChangedScope: false,
    codeAreas: ["rust-production"],
    locations: [
      {
        path: "crates/shared/protocol/src/envelope.rs",
        startLine: 62 + startLineOffset,
        endLine: 75 + startLineOffset,
        codeArea: "rust-production"
      },
      {
        path: "crates/shared/protocol/src/operation_result.rs",
        startLine: 14 + startLineOffset,
        endLine: 27 + startLineOffset,
        codeArea: "rust-production"
      }
    ]
  };
}

function acceptedProtocolOperationDuplicateAcceptance(): AcceptedWarningConfig {
  return {
    ruleId: "jscpd-duplicate-code",
    sourceTool: "jscpd",
    codeArea: "rust-production",
    metric: "duplicate-tokens",
    suggestionIncludes: [
      "crates/shared/protocol/src/envelope.rs",
      "crates/shared/protocol/src/operation_result.rs"
    ],
    reason:
      "OperationArguments::operation and OperationResult::operation map the same Operation enum variants at separate protocol request and result boundaries."
  };
}

function configWithAcceptedWarnings(acceptedWarnings: AcceptedWarningConfig[]): QualityConfig {
  return {
    ...TEST_QUALITY_CONFIG,
    acceptedWarnings
  };
}
