import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  buildBaselineSnapshotCacheKey,
  buildScanCacheKey,
  createBaselineSnapshotCacheIdentity,
  loadBaselineSnapshotCacheEntry,
  loadScanCacheEntry,
  writeBaselineSnapshotCacheEntry,
  writeScanCacheEntry,
  type BaselineSnapshotCacheIdentity,
  type DuplicateCodeCacheIdentity
} from "./cache.ts";
import type { BaselineSnapshot, DuplicateCodeFragment } from "../model/schema.ts";
import { TEST_QUALITY_CONFIG } from "../../test/config.ts";

const TEST_CODE_AREA = "typescript-production-scripts";
const BASELINE_SNAPSHOT: BaselineSnapshot = {
  fingerprints: {
    [TEST_CODE_AREA]: {
      fileCount: 1,
      fileList: ["scripts/risky.ts"],
      fingerprint: "sha256:baseline:1"
    }
  },
  fileMetrics: [{
    path: "scripts/risky.ts",
    language: "TypeScript",
    lines: 12,
    codeLines: 10,
    codeArea: TEST_CODE_AREA,
    isChanged: false,
    decisionTokens: { value: 2, source: "scc" }
  }],
  functionMetrics: [{
    name: "risky",
    file: "scripts/risky.ts",
    codeArea: TEST_CODE_AREA,
    startLine: 1,
    endLine: 10,
    lines: 10,
    parameterCount: 1,
    cyclomaticComplexity: { value: 2, source: "lizard" },
    isChanged: false
  }],
  duplicateCode: [],
  aggregates: {
    byLanguage: [{
      language: "TypeScript",
      files: 1,
      lines: 12,
      codeLines: 10,
      commentLines: 1,
      blankLines: 1
    }],
    byCodeArea: [{
      codeArea: TEST_CODE_AREA,
      files: 1,
      lines: 12,
      codeLines: 10,
      fileDecisionTokens: 2,
      functions: 1,
      functionLines: 10,
      parameterCount: 1,
      cyclomaticComplexity: 2,
      duplicateFragments: 0,
      warningPolicy: "moderate"
    }],
    overall: {
      totalFiles: 1,
      totalLines: 12,
      totalCodeLines: 10,
      totalFileDecisionTokens: 2,
      totalFunctions: 1,
      totalFunctionLines: 10,
      totalFunctionParameters: 1,
      totalFunctionCyclomaticComplexity: 2,
      totalDuplicateFragments: 0
    }
  }
};

// @case AUX-QUALITY-CACHE-001
describe("quality measurement cache", () => {
  it("keys duplicate-code cache by scan identity and strips changed-scope annotations", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-cache-"));
    const identity = cacheIdentity();
    const fragment = duplicateFragment();
    fragment.hitsChangedScope = true;

    try {
      const baseKey = buildScanCacheKey(identity);
      assert.notEqual(baseKey, buildScanCacheKey({ ...identity, codeArea: "rust-tests" }));
      assert.notEqual(
        baseKey,
        buildScanCacheKey({
          ...identity,
          inputFingerprint: {
            fileCount: 1,
            fileList: ["src/changed.ts"],
            fingerprint: "sha256:changed:1"
          }
        })
      );

      writeScanCacheEntry({ rootDir: tempDir, identity, metrics: [fragment] });

      const hit = loadScanCacheEntry({ rootDir: tempDir, identity });
      assert.equal(hit.hit, true);
      assert.equal(hit.hit ? hit.metrics[0]!.hitsChangedScope : true, false);
      assert.equal(
        hit.hit ? relative(tempDir, hit.cachePath).split("\\").join("/") : "",
        `quality-scan-cache-v1/${baseKey}.json`
      );

      const oldPmdIdentity = {
        ...identity,
        toolName: "pmd-cpd" as "jscpd",
        toolVersion: "7.25.0"
      };
      assert.notEqual(baseKey, buildScanCacheKey(oldPmdIdentity));
      assert.notEqual(
        baseKey,
        buildScanCacheKey({
          ...identity,
          normalizedToolArgs: ["exec", "jscpd", "--min-tokens", "75", "--reporters", "json"]
        })
      );

      const mismatched = loadScanCacheEntry({
        rootDir: tempDir,
        identity: { ...identity, toolVersion: "5.0.12" }
      });
      assert.equal(mismatched.hit, false);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("reuses baseline snapshots only when identity and snapshot hash match", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-baseline-cache-"));
    const identity = baselineSnapshotIdentity();
    const snapshot = BASELINE_SNAPSHOT;

    try {
      const baseKey = buildBaselineSnapshotCacheKey(identity);
      assert.notEqual(
        baseKey,
        buildBaselineSnapshotCacheKey(baselineSnapshotIdentity("1.24.0"))
      );

      const written = writeBaselineSnapshotCacheEntry({ rootDir: tempDir, identity, snapshot });
      const hit = loadBaselineSnapshotCacheEntry({ rootDir: tempDir, identity });
      assert.equal(hit.hit, true);
      assert.deepEqual(hit.hit ? hit.snapshot : null, snapshot);

      const modifiedSnapshot = {
        ...snapshot,
        fileMetrics: []
      };
      writeFileSync(
        join(written.cacheDir, "snapshot.json"),
        `${JSON.stringify(modifiedSnapshot, null, 2)}\n`,
        "utf8"
      );

      const mismatched = loadBaselineSnapshotCacheEntry({ rootDir: tempDir, identity });
      assert.equal(mismatched.hit, false);
      assert.equal(mismatched.hit ? "" : mismatched.reason, "cache-snapshot-hash-mismatch");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function cacheIdentity(): DuplicateCodeCacheIdentity {
  return {
    scanKind: "current",
    toolName: "jscpd",
    toolVersion: "5.0.11",
    normalizedToolArgs: ["<repo-local-jscpd-bin>", "--min-tokens", "75", "--reporters", "json"],
    configVersion: "quality-observability-v1",
    codeArea: TEST_CODE_AREA,
    commitSha: "abc123",
    inputFingerprint: {
      fileCount: 1,
      fileList: ["src/risky.ts"],
      fingerprint: "sha256:test:1"
    }
  };
}

function duplicateFragment(): DuplicateCodeFragment {
  return {
    id: 1,
    tokenCount: 90,
    lineCount: 10,
    codeAreas: [],
    hitsChangedScope: false,
    locations: [
      { path: "src/a.ts", startLine: 10, endLine: 20, codeArea: "unknown" },
      { path: "src/b.ts", startLine: 11, endLine: 21, codeArea: "unknown" }
    ]
  };
}

function baselineSnapshotIdentity(lizardVersion = "1.23.0"): BaselineSnapshotCacheIdentity {
  return createBaselineSnapshotCacheIdentity({
    commitSha: "abc123",
    config: TEST_QUALITY_CONFIG,
    toolResults: [
      {
        name: "lizard",
        available: true,
        version: lizardVersion,
        error: null,
        source: "uv"
      },
      {
        name: "scc",
        available: true,
        version: "3.7.0",
        error: null,
        source: "system"
      },
      {
        name: "jscpd",
        available: true,
        version: "5.0.11",
        error: null,
        source: "repository devDependency"
      }
    ]
  });
}
