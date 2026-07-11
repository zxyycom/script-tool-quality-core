import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLizardCSV } from "./scanners/lizard.ts";
import {
  parseJscpdJsonReport,
  parseJscpdVersionOutput,
  scanWithJscpd
} from "./scanners/jscpd/scanner.ts";
import {
  SCC_BY_FILE_CSV_HEADER,
  parseSccCSV
} from "./scanners/scc.ts";
import { checkJscpd } from "./scanners/tool-availability/jscpd.ts";
import { TEST_QUALITY_CONFIG } from "../../test/config.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("quality scanner output parsing", () => {
  // @case AUX-QUALITY-PARSER-001
  it("parses scc 3.7 Provider paths and rejects unknown CSV headers", () => {
    const csv = [
      SCC_BY_FILE_CSV_HEADER,
      "Rust,crates/docnav/src/lib.rs,lib.rs,120,90,20,10,17,4096,70",
      "TypeScript,scripts/quality/scan.ts,scan.ts,60,50,5,5,8,2048,45"
    ].join("\n");

    const result = parseSccCSV(csv, "/repo");

    assert.equal(result.ok, true);
    assert.deepEqual(result.files!.map((f) => f.path), [
      "crates/docnav/src/lib.rs",
      "scripts/quality/scan.ts"
    ]);
    assert.equal(result.files![0]!.decisionTokens.value, 17);
    assert.equal(
      parseSccCSV("Language,Location,Filename,Lines,Code,Comments,Blanks,Complexity,Bytes\n", "/repo").ok,
      false
    );
  });

  it("parses Lizard 1.23 function rows", () => {
    const csv = [
      "271,88,1887,7,326,\"generateWarnings@35-360@scripts/tools/quality-core/src/output/warnings/generator.ts\",\"scripts/tools/quality-core/src/output/warnings/generator.ts\",\"generateWarnings\",\"generateWarnings ( files , functions , duplicates , config , scope , baseline , comparisonStatus )\",35,360"
    ].join("\n");

    const result = parseLizardCSV(csv);

    assert.equal(result.ok, true);
    assert.deepEqual(result.functions![0], {
      name: "generateWarnings",
      file: "scripts/tools/quality-core/src/output/warnings/generator.ts",
      codeArea: "unknown",
      startLine: 35,
      endLine: 360,
      lines: 271,
      parameterCount: 7,
      cyclomaticComplexity: {
        value: 88,
        source: "lizard"
      },
      isChanged: false
    });
  });

  it("parses jscpd version and JSON output", () => {
    const json = JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name: "\\\\?\\D:\\repo\\crates\\docnav\\src\\a.rs",
            start: 10,
            end: 20,
            startLoc: { line: 10 },
            endLoc: { line: 20 }
          },
          secondFile: {
            name: "\\\\?\\D:\\repo\\crates\\docnav\\src\\b.rs",
            start: 5,
            end: 15,
            startLoc: { line: 5 },
            endLoc: { line: 15 }
          },
          lines: 10,
          tokens: 50
        }
      ],
      statistics: { total: { clones: 1 } }
    });

    const result = parseJscpdJsonReport(json, "D:\\repo");

    // jscpd 5.x delegates to its bundled Rust binary, which reports a cpd prefix.
    assert.equal(parseJscpdVersionOutput("cpd 5.0.11"), "5.0.11");
    assert.equal(result.ok, true);
    assert.equal(result.fragments[0]!.tokenCount, 50);
    assert.equal(result.fragments[0]!.lineCount, 10);
    assert.deepEqual(result.fragments[0]!.locations.map((location) => location.path), [
      "crates/docnav/src/a.rs",
      "crates/docnav/src/b.rs"
    ]);
    assert.deepEqual(result.fragments[0]!.locations.map((location) => [location.startLine, location.endLine]), [
      [10, 20],
      [5, 15]
    ]);
  });

  it("classifies invalid jscpd JSON and duplicate items as parse failures", () => {
    const invalidJson = parseJscpdJsonReport("{", "D:\\repo");
    assert.equal(invalidJson.ok, false);
    if (!invalidJson.ok) {
      assert.equal(invalidJson.skipped, false);
      assert.equal(invalidJson.reason, "jscpd-parse-failure");
    }

    const invalidDuplicate = parseJscpdJsonReport(JSON.stringify({ duplicates: [null] }), "D:\\repo");
    assert.equal(invalidDuplicate.ok, false);
    if (!invalidDuplicate.ok) {
      assert.equal(invalidDuplicate.skipped, false);
      assert.equal(invalidDuplicate.reason, "jscpd-parse-failure");
      assert.match(invalidDuplicate.error, /duplicate #1 must be an object/);
    }
  });
});

describe("quality jscpd wrapper failure projection", () => {
  // @case AUX-QUALITY-JSCPD-WRAPPER-001
  it("does not treat a successful jscpd run without JSON as a successful empty scan", () => {
    const toolConfig = createFakeJscpdToolConfig({ stdout: "", stderr: "", exitCode: 0 });

    try {
      const result = scanWithJscpd({
        files: ["scripts/a.ts", "scripts/b.ts"],
        cwd: REPO_ROOT,
        toolConfig,
        minimumTokens: 75,
        format: TEST_QUALITY_CONFIG.jscpd.formatByCodeArea["typescript-production-scripts"]
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.skipped, false);
        assert.equal(result.reason, "jscpd-report-failure");
        assert.match(result.error, /jscpd JSON report missing/);
      }
    } finally {
      toolConfig.cleanup();
    }
  });

  it("classifies empty jscpd JSON reports as report failures", () => {
    const toolConfig = createFakeJscpdToolConfig({
      stdout: "",
      stderr: "",
      exitCode: 0,
      reportJson: "   \n"
    });

    try {
      const result = scanWithJscpd({
        files: ["scripts/a.ts", "scripts/b.ts"],
        cwd: REPO_ROOT,
        toolConfig,
        minimumTokens: 75,
        format: TEST_QUALITY_CONFIG.jscpd.formatByCodeArea["typescript-production-scripts"]
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.skipped, false);
        assert.equal(result.reason, "jscpd-report-failure");
        assert.match(result.error, /jscpd JSON report is empty/);
      }
    } finally {
      toolConfig.cleanup();
    }
  });

  it("classifies missing jscpd tools as skipped unavailable scans", () => {
    const result = scanWithJscpd({
      files: ["scripts/a.ts", "scripts/b.ts"],
      cwd: REPO_ROOT,
      toolConfig: {
        command: join(REPO_ROOT, `docnav-missing-jscpd-${process.pid}.cmd`),
        args: []
      },
      minimumTokens: 75,
      format: TEST_QUALITY_CONFIG.jscpd.formatByCodeArea["typescript-production-scripts"]
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "tool-unavailable");
      assert.match(result.error, /jscpd not found/);
    }
  });

  it("classifies unavailable jscpd dependency binaries in tool availability", async () => {
    const result = await checkJscpd(REPO_ROOT, {
      command: join(REPO_ROOT, `docnav-missing-jscpd-${process.pid}.cmd`),
      args: []
    });

    assert.equal(result.available, false);
    assert.equal(result.reason, "tool-unavailable");
    assert.match(result.error ?? "", /jscpd dependency binary unavailable/);
  });

  it("keeps real duplicate findings non-fatal and normalizes jscpd JSON", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-jscpd-real-"));
    const duplicateSource = [
      "export function duplicatedExample(value: number): number {",
      "  let total = value;",
      "  total += 1;",
      "  total += 2;",
      "  total += 3;",
      "  total += 4;",
      "  total += 5;",
      "  total += 6;",
      "  total += 7;",
      "  total += 8;",
      "  total += 9;",
      "  total += 10;",
      "  return total;",
      "}",
      ""
    ].join("\n");

    writeFileSync(join(tempDir, "a.ts"), duplicateSource, "utf8");
    writeFileSync(join(tempDir, "b.ts"), duplicateSource, "utf8");

    try {
      const result = scanWithJscpd({
        files: [join(tempDir, "a.ts"), join(tempDir, "b.ts")],
        cwd: tempDir,
        toolConfig: TEST_QUALITY_CONFIG.tools.jscpd,
        format: TEST_QUALITY_CONFIG.jscpd.formatByCodeArea["typescript-production-scripts"],
        minimumTokens: 20
      });

      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.fragments.length, 1);
        assert.equal(result.fragments[0]!.locations.length, 2);
        assert.deepEqual(result.fragments[0]!.locations.map((location) => location.path), ["a.ts", "b.ts"]);
        assert.equal(result.fragments[0]!.hitsChangedScope, false);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("classifies non-zero jscpd exits as execution failures, not skipped scans", () => {
    const toolConfig = createFakeJscpdToolConfig({ stdout: "", stderr: "bad invocation", exitCode: 2 });

    try {
      const result = scanWithJscpd({
        files: ["scripts/a.ts", "scripts/b.ts"],
        cwd: REPO_ROOT,
        toolConfig,
        minimumTokens: 50,
        format: TEST_QUALITY_CONFIG.jscpd.formatByCodeArea["typescript-production-scripts"]
      });

      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.skipped, false);
        assert.equal(result.reason, "jscpd-execution-error");
        assert.match(result.error, /jscpd exit 2: bad invocation/);
      }
    } finally {
      toolConfig.cleanup();
    }
  });
});

function createFakeJscpdToolConfig({
  reportJson,
  stdout,
  stderr,
  exitCode
}: {
  exitCode: number;
  reportJson?: string;
  stderr: string;
  stdout: string;
}) {
  const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-jscpd-"));
  const fakeJscpdPath = join(tempDir, "fake-jscpd.ts");

  writeFileSync(fakeJscpdPath, `
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const outputIndex = process.argv.indexOf("--output");
if (${JSON.stringify(reportJson)} !== undefined && outputIndex >= 0) {
  const outputDir = process.argv[outputIndex + 1];
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "jscpd-report.json"), ${JSON.stringify(reportJson)}, "utf8");
}
process.stdout.write(${JSON.stringify(stdout)});
console.error(${JSON.stringify(stderr)});
process.exit(${JSON.stringify(exitCode)});
`, "utf8");

  return {
    command: process.execPath,
    args: [fakeJscpdPath],
    cleanup: () => rmSync(tempDir, { recursive: true, force: true })
  };
}
