import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { buildFingerprints, getChangedFileList } from "./files.ts";
import { gitGlobPathspecArgs } from "./git-pathspec.ts";

// @case AUX-QUALITY-FINGERPRINT-001
describe("quality input fingerprints", () => {
  it("uses stable SHA-256 fingerprints for sorted file content", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-fingerprint-"));
    const orderedFileMap = new Map([["typescript", ["src/a.ts", "src/b.ts"]]]);
    const reversedFileMap = new Map([["typescript", ["src/b.ts", "src/a.ts"]]]);

    try {
      writeFixtureFile(tempDir, "src/a.ts", "export const a = 1;\n");
      writeFixtureFile(tempDir, "src/b.ts", "export const b = 2;\n");

      const ordered = buildFingerprints(orderedFileMap, tempDir).typescript;
      const reversed = buildFingerprints(reversedFileMap, tempDir).typescript;
      assert.equal(reversed.fingerprint, ordered.fingerprint);
      assert.match(ordered.fingerprint, /^sha256:[a-f0-9]{64}:2$/);

      writeFixtureFile(tempDir, "src/b.ts", "export const b = 3;\n");
      const changed = buildFingerprints(orderedFileMap, tempDir).typescript;
      assert.notEqual(changed.fingerprint, ordered.fingerprint);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// @case AUX-QUALITY-GIT-PATHSPEC-001
describe("quality input git pathspecs", () => {
  it("builds explicit git pathspec arguments and can omit empty pathspecs", () => {
    assert.deepEqual(gitGlobPathspecArgs(["scripts/**/*.ts"]), ["--", ":(glob)scripts/**/*.ts"]);
    assert.deepEqual(gitGlobPathspecArgs([]), ["--"]);
    assert.deepEqual(gitGlobPathspecArgs([], { omitWhenEmpty: true }), []);
  });
});

// @case AUX-QUALITY-CHANGED-FILES-001
describe("quality changed file input", () => {
  it("fails fast when an explicit changed-files list cannot be read", () => {
    assert.throws(
      () => getChangedFileList({ changedFiles: "missing-changed-files.txt" }, process.cwd()),
      /failed to read --changed-files missing-changed-files\.txt/
    );
  });
});

function writeFixtureFile(rootDir: string, relPath: string, content: string): void {
  const absPath = join(rootDir, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, "utf8");
}
