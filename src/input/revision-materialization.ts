/** Materialize submodule revisions into an extracted baseline workspace. */

import { existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { processFailed, runGit, runProcessSync } from "../../../foundation/src/index.ts";
import { gitlinksAtRevision, type Gitlink } from "./revision-tree.ts";

export function materializeRevisionGitlinks({
  archiveDir,
  archiveIndex,
  repository,
  revision,
  targetDir
}: {
  archiveDir: string;
  archiveIndex: { value: number };
  repository: string;
  revision: string;
  targetDir: string;
}): string | null {
  const gitlinks = gitlinksAtRevision(repository, revision);
  if (gitlinks === null) {
    return `git ls-tree failed while reading submodules at ${revision}`;
  }

  for (const gitlink of gitlinks) {
    const materialized = materializeGitlink({
      archiveDir,
      archiveIndex,
      gitlink,
      repository,
      targetDir
    });
    if (!materialized.ok) return materialized.error;

    const nestedError = materializeRevisionGitlinks({
      archiveDir,
      archiveIndex,
      repository: materialized.repository,
      revision: gitlink.sha,
      targetDir: materialized.targetDir
    });
    if (nestedError) return nestedError;
  }

  return null;
}

function materializeGitlink({
  archiveDir,
  archiveIndex,
  gitlink,
  repository,
  targetDir
}: {
  archiveDir: string;
  archiveIndex: { value: number };
  gitlink: Gitlink;
  repository: string;
  targetDir: string;
}): { ok: true; repository: string; targetDir: string } | { error: string; ok: false } {
  const submoduleRepository = resolve(repository, gitlink.path);
  const submoduleTarget = resolve(targetDir, gitlink.path);
  if (!isStrictDescendant(targetDir, submoduleTarget)) {
    return { ok: false, error: `submodule path escapes baseline workspace: ${gitlink.path}` };
  }
  if (!existsSync(submoduleRepository)) {
    return { ok: false, error: `initialized submodule repository is missing: ${gitlink.path}` };
  }

  const archivePath = join(archiveDir, `submodule-${archiveIndex.value}.tar`);
  archiveIndex.value += 1;
  const archiveError = archiveRevision(submoduleRepository, gitlink.sha, archivePath, gitlink.path);
  if (archiveError) return { ok: false, error: archiveError };

  mkdirSync(submoduleTarget, { recursive: true });
  const extractError = extractArchive(archivePath, submoduleTarget, archiveDir, gitlink.path);
  if (extractError) return { ok: false, error: extractError };

  return { ok: true, repository: submoduleRepository, targetDir: submoduleTarget };
}

function archiveRevision(
  repository: string,
  revision: string,
  archivePath: string,
  label: string
): string | null {
  const result = runGit(["archive", "--format=tar", "--output", archivePath, revision], {
    cwd: repository
  });
  return processFailed(result)
    ? `git archive failed for submodule ${label} at ${revision}: ` +
      `${result.error?.message || result.stderr || "exit " + result.status}`
    : null;
}

function extractArchive(
  archivePath: string,
  targetDir: string,
  cwd: string,
  label: string
): string | null {
  const result = runProcessSync("tar", ["-xf", archivePath, "-C", targetDir], { cwd });
  return processFailed(result)
    ? `tar extract failed for submodule ${label}: ` +
      `${result.error?.message || result.stderr || "exit " + result.status}`
    : null;
}

function isStrictDescendant(parent: string, child: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
