import { describe, expect, test } from "bun:test";

import {
  classifyFiles,
  generateWarningChannels,
  validateMetrics
} from "../src/index.ts";
import { TEST_QUALITY_CONFIG as config } from "./config.ts";

describe("script quality core", () => {
  test("classifies files using caller-provided code areas", () => {
    const fileMap = classifyFiles(["scripts/a.ts", "scripts/a.test.ts"], config.codeAreas, config.generatedFiles);

    expect(fileMap.get("typescript-production-scripts")).toEqual(["scripts/a.ts"]);
  });

  test("rejects a metrics envelope without metadata", () => {
    const validation = validateMetrics({});

    expect(validation.valid).toBe(false);
    expect(validation.errors.includes("metrics.metadata is required")).toBe(true);
  });

  test("generates warning channels from caller-provided thresholds", () => {
    const warnings = generateWarningChannels({
      files: [
        {
          codeArea: "typescript-production-scripts",
          codeLines: 301,
          decisionTokens: { source: "scc", value: 11 },
          isChanged: true,
          language: "TypeScript",
          lines: 320,
          path: "scripts/a.ts"
        }
      ],
      functions: [],
      duplicates: [],
      config,
      scope: { changed: true, changedFiles: ["scripts/a.ts"] },
      baseline: null,
      comparisonStatus: "baseline-unavailable",
      validateAcceptedWarnings: false
    });

    expect(warnings.all.map((warning) => [
      warning.ruleId,
      warning.codeArea,
      warning.path,
      warning.value
    ])).toEqual([[
      "scc-file-code-lines",
      "typescript-production-scripts",
      "scripts/a.ts",
      301
    ]]);
    expect(warnings.changed).toHaveLength(0);
  });
});
