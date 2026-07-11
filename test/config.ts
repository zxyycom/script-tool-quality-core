import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { QualityConfig } from "../src/index.ts";

const JSCPD_ENTRY = resolve(
  dirname(fileURLToPath(import.meta.resolve("jscpd/package.json"))),
  "run-jscpd.js"
);

export const TEST_QUALITY_CONFIG: QualityConfig = {
  acceptedWarnings: [],
  artifactDir: "artifacts/quality",
  cacheDir: ".cache/quality",
  codeAreas: {
    "typescript-production-scripts": {
      description: "TypeScript production scripts",
      globs: ["scripts/**/*.ts"],
      excludeGlobs: ["scripts/**/*.test.ts"],
      warningPolicy: "moderate"
    },
    "typescript-validation-smoke": {
      description: "TypeScript validation and smoke tests",
      globs: ["test/**/*.ts"],
      excludeGlobs: [],
      warningPolicy: "relaxed"
    }
  },
  excludeDirs: [".git", "node_modules"],
  generatedFiles: ["**/generated/**"],
  include: ["scripts/**/*.ts", "test/**/*.ts"],
  jscpd: {
    defaultMinimumTokens: 100,
    duplicateFragments: { changedDelta: 0 },
    formatByCodeArea: {
      "typescript-production-scripts": "typescript",
      "typescript-validation-smoke": "typescript"
    },
    maxParallelTasks: 2,
    minimumTokens: {
      "typescript-production-scripts": 75,
      "typescript-validation-smoke": 100
    }
  },
  lizard: {
    cyclomaticComplexity: { absoluteFloor: 10, changedDelta: 5 },
    functionCodeDensity: {
      absoluteFloor: 50,
      changedDelta: 20,
      lowComplexityAllowance: {
        codeLineFloor: 150,
        maxCyclomaticComplexityExclusive: 5
      }
    },
    parameterCount: { absoluteFloor: 5, changedDelta: 2 }
  },
  report: {
    title: "Test Code Quality Snapshot",
    nonBlockingNotice: "Test quality metrics are observational.",
    footerGeneratedBy: "quality-core test fixture",
    footerNotice: "Test quality metrics are observational.",
    showWatchlist: true,
    timeZone: "UTC",
    topN: 5,
    watchlistMax: 10
  },
  scc: {
    fileCodeLines: {
      absoluteFloor: 300,
      changedDelta: 100,
      lowDecisionTokenAllowance: {
        codeLineFloor: 500,
        maxDecisionTokens: 10
      }
    }
  },
  tools: {
    jscpd: { command: process.execPath, args: [JSCPD_ENTRY] },
    lizard: { command: "python", args: ["-m", "lizard"] },
    scc: { command: "scc", args: [] }
  },
  version: "test-quality-core"
};
