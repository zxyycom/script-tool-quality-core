import { isNonArrayRecord } from "../../../../foundation/src/index.ts";
import type {
  BaselineSnapshot,
  DuplicateCodeFragment,
  DuplicateCodeLocation
} from "../../model/schema.ts";
import { stableStringify } from "./key.ts";
import {
  SCAN_CACHE_VERSION,
  type BaselineSnapshotCacheIdentity,
  type BaselineSnapshotCacheManifest,
  type DuplicateCodeCacheIdentity,
  type ScanCachePayload
} from "./types.ts";

export function isMatchingPayload(
  payload: unknown,
  identity: DuplicateCodeCacheIdentity,
  cacheKey: string
): payload is ScanCachePayload {
  if (!isNonArrayRecord(payload)) return false;

  return cacheIdentityFieldsMatch(payload, identity, cacheKey) &&
    cacheStructuredFieldsMatch(payload, identity);
}

export function isMetricArray(value: unknown): value is DuplicateCodeFragment[] {
  if (!Array.isArray(value)) return false;
  return value.every(isDuplicateCodeFragment);
}

export function stripDuplicateChangedScope(metrics: DuplicateCodeFragment[]): DuplicateCodeFragment[] {
  return metrics.map((fragment) => ({
    ...fragment,
    codeAreas: [...fragment.codeAreas],
    hitsChangedScope: false,
    locations: fragment.locations.map((location) => ({ ...location }))
  }));
}

export function isMatchingBaselineSnapshotManifest(
  manifest: unknown,
  identity: BaselineSnapshotCacheIdentity,
  cacheKey: string
): manifest is BaselineSnapshotCacheManifest {
  if (!isNonArrayRecord(manifest)) return false;

  return manifest.scanCacheVersion === SCAN_CACHE_VERSION &&
    manifest.cacheKey === cacheKey &&
    typeof manifest.createdAt === "string" &&
    typeof manifest.snapshotHash === "string" &&
    stableStringify(manifest.identity) === stableStringify(identity);
}

export function isBaselineSnapshot(value: unknown): value is BaselineSnapshot {
  if (!isNonArrayRecord(value)) return false;
  const aggregates = value.aggregates;

  return isNonArrayRecord(value.fingerprints) &&
    Array.isArray(value.fileMetrics) &&
    Array.isArray(value.functionMetrics) &&
    Array.isArray(value.duplicateCode) &&
    isNonArrayRecord(aggregates) &&
    Array.isArray(aggregates.byCodeArea) &&
    Array.isArray(aggregates.byLanguage) &&
    isNonArrayRecord(aggregates.overall);
}

function cacheIdentityFieldsMatch(
  payload: Record<string, unknown>,
  identity: DuplicateCodeCacheIdentity,
  cacheKey: string
): boolean {
  return payload.scanCacheVersion === SCAN_CACHE_VERSION &&
    payload.cacheKey === cacheKey &&
    payload.scanKind === identity.scanKind &&
    payload.toolName === identity.toolName &&
    payload.toolVersion === identity.toolVersion &&
    payload.configVersion === identity.configVersion &&
    payload.codeArea === identity.codeArea &&
    payload.commitSha === identity.commitSha;
}

function cacheStructuredFieldsMatch(payload: Record<string, unknown>, identity: DuplicateCodeCacheIdentity): boolean {
  return stableStringify(payload.normalizedToolArgs) === stableStringify([...identity.normalizedToolArgs]) &&
    stableStringify(payload.inputFingerprint) === stableStringify(identity.inputFingerprint);
}

function isDuplicateCodeFragment(value: unknown): value is DuplicateCodeFragment {
  return isNonArrayRecord(value) &&
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.tokenCount) &&
    isFiniteNumber(value.lineCount) &&
    typeof value.hitsChangedScope === "boolean" &&
    Array.isArray(value.codeAreas) &&
    value.codeAreas.every((area) => typeof area === "string") &&
    Array.isArray(value.locations) &&
    value.locations.every(isDuplicateCodeLocation);
}

function isDuplicateCodeLocation(value: unknown): value is DuplicateCodeLocation {
  return isNonArrayRecord(value) &&
    typeof value.path === "string" &&
    isFiniteNumber(value.startLine) &&
    isFiniteNumber(value.endLine) &&
    typeof value.codeArea === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
