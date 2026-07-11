import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  buildFingerprints,
  collectBaselineFiles,
  collectScanFiles,
  getChangedFileList,
  type ScanInputConfig
} from "./files.ts";
import { gitGlobPathspecArgs } from "./git-pathspec.ts";
import { detectScanInputChange, materializeBaselineRevision } from "./revisions.ts";

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

  it("keeps current, changed, and baseline submodule files aligned", { timeout: 20_000 }, () => {
    const tempDir = mkdtempSync(join(tmpdir(), "docnav-quality-submodule-"));
    const submoduleOrigin = join(tempDir, "submodule-origin");
    const repository = join(tempDir, "repository");
    const submodulePath = join(repository, "modules", "tool");
    const committedPath = "modules/tool/src/committed.ts";
    const untrackedPath = "modules/tool/src/untracked.ts";
    const workingPath = "modules/tool/src/working.ts";
    const config = {
      excludeDirs: [".git"],
      generatedFiles: [],
      include: ["modules/tool/**/*.ts"]
    } satisfies ScanInputConfig;

    try {
      initializeRepository(submoduleOrigin);
      writeFixtureFile(submoduleOrigin, "src/committed.ts", "export const committed = 1;\n");
      writeFixtureFile(submoduleOrigin, "src/working.ts", "export const working = 1;\n");
      const baselineSubmoduleSha = commitAll(submoduleOrigin, "baseline");
      writeFixtureFile(submoduleOrigin, "src/committed.ts", "export const committed = 2;\n");
      const currentSubmoduleSha = commitAll(submoduleOrigin, "current");

      initializeRepository(repository);
      git(repository, [
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        submoduleOrigin,
        "modules/tool"
      ]);
      git(submodulePath, ["checkout", "--detach", baselineSubmoduleSha]);
      const baselineRootSha = commitAll(repository, "baseline submodule");
      git(submodulePath, ["checkout", "--detach", currentSubmoduleSha]);
      commitAll(repository, "current submodule");
      writeFixtureFile(submodulePath, "src/working.ts", "export const working = 2;\n");
      writeFixtureFile(submodulePath, "src/untracked.ts", "export const untracked = true;\n");

      assert.deepEqual(
        collectScanFiles(repository, config),
        [committedPath, untrackedPath, workingPath]
      );

      const scope = detectScanInputChange({
        baselineSha: baselineRootSha,
        cwd: repository,
        scanInputPaths: config.include
      });
      assert.equal(scope.changed, true);
      assert.deepEqual(scope.changedFiles.sort(), [committedPath, untrackedPath, workingPath]);
      assert.deepEqual(
        getChangedFileList({ scanInputPaths: config.include }, repository).sort(),
        [committedPath, untrackedPath, workingPath]
      );

      const materialized = materializeBaselineRevision({
        baselineWorkDir: join(tempDir, "materialized"),
        commitSha: baselineRootSha,
        cwd: repository
      });
      assert.equal(materialized.ok, true, materialized.ok ? undefined : materialized.error);
      if (!materialized.ok) return;

      assert.deepEqual(collectBaselineFiles(materialized.workDir, config), [committedPath, workingPath]);
      assert.equal(
        readFileSync(join(materialized.workDir, committedPath), "utf8").trim(),
        "export const committed = 1;"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function writeFixtureFile(rootDir: string, relPath: string, content: string): void {
  const absPath = join(rootDir, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, "utf8");
}

function initializeRepository(repository: string): void {
  mkdirSync(repository, { recursive: true });
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.email", "quality-test@example.invalid"]);
  git(repository, ["config", "user.name", "Quality Test"]);
}

function commitAll(repository: string, message: string): string {
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", message]);
  return git(repository, ["rev-parse", "HEAD"]);
}

function git(repository: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8"
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  return result.stdout.trim();
}
