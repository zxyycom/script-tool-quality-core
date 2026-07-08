import { createHash } from "node:crypto";
import { join } from "node:path";

import { isNonArrayRecord } from "../../../../foundation/src/index.ts";
import {
  BASELINE_SNAPSHOT_CACHE_KIND,
  SCAN_CACHE_VERSION,
  type BaselineSnapshotCacheIdentity,
  type DuplicateCodeCacheIdentity
} from "./types.ts";

export function buildScanCacheKey(identity: DuplicateCodeCacheIdentity): string {
  const keyInput = {
    scan_cache_version: SCAN_CACHE_VERSION,
    scan_kind: identity.scanKind,
    tool_name: identity.toolName,
    tool_version: identity.toolVersion,
    normalized_tool_args: [...identity.normalizedToolArgs],
    config_version: identity.configVersion,
    code_area: identity.codeArea,
    commit_sha: identity.commitSha,
    input_fingerprint: identity.inputFingerprint
  };

  return hashStable(keyInput);
}

export function buildBaselineSnapshotCacheKey(identity: BaselineSnapshotCacheIdentity): string {
  const keyInput = {
    scan_cache_version: SCAN_CACHE_VERSION,
    cache_kind: BASELINE_SNAPSHOT_CACHE_KIND,
    identity
  };

  return hashStable(keyInput);
}

export function getScanCachePath(rootDir: string, cacheKey: string): string {
  return join(getQualityCacheRoot(rootDir), `${cacheKey}.json`);
}

export function getBaselineSnapshotCacheDir(rootDir: string, cacheKey: string): string {
  return join(getQualityCacheRoot(rootDir), "baseline-snapshots", cacheKey);
}

function getQualityCacheRoot(rootDir: string): string {
  return join(rootDir, SCAN_CACHE_VERSION);
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (isNonArrayRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
