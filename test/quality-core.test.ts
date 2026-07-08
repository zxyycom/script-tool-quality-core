import { describe, expect, test } from "bun:test";

import {
  classifyFiles,
  createEmptyMetrics,
  generateWarningChannels,
  validateMetrics
} from "../src/index.ts";
import { TEST_QUALITY_CONFIG as config } from "./config.ts";

describe("script quality core", () => {
  test("classifies files using caller-provided code areas", () => {
    const fileMap = classifyFiles(["scripts/a.ts", "scripts/a.test.ts"], config.codeAreas, config.generatedFiles);

    expect(fileMap.get("typescript-production-scripts")).toEqual(["scripts/a.ts"]);
  });

  test("creates and validates a metrics envelope", () => {
    const metrics = createEmptyMetrics({
      repository: "/repo",
      commitSha: "abc123",
      commitTitle: "test",
      configVersion: config.version,
      tools: [],
      scope: {
        include: config.include,
        excludeDirs: config.excludeDirs,
        generatedFiles: config.generatedFiles
      }
    });

    expect(validateMetrics(metrics).valid).toBe(true);
  });

  test("generates warning channels from caller-provided thresholds", () => {
    const warnings = generateWarningChannels({
      files: [
        {
          codeArea: "scripts",
          codeLines: 301,
          decisionTokens: { source: "scc", value: 1 },
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

    expect(warnings.all).toHaveLength(0);
    expect(warnings.changed).toHaveLength(0);
  });
});
