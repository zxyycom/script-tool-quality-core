import type {
  BaselineSnapshot,
  CodeAreaFingerprint,
  CodeAreaDefinition,
  DuplicateCodeFragment,
  ToolAvailability
} from "../../model/schema.ts";

export const SCAN_CACHE_VERSION = "quality-scan-cache-v1";
export const BASELINE_SNAPSHOT_CACHE_KIND = "baseline-snapshot";

export type ScanKind = "baseline" | "current";

export type DuplicateCodeCacheIdentity = {
  codeArea: string;
  commitSha: string;
  configVersion: string;
  inputFingerprint: CodeAreaFingerprint;
  normalizedToolArgs: readonly string[];
  scanKind: ScanKind;
  toolName: "jscpd";
  toolVersion: string;
};

export type DuplicateCodeCacheHit = {
  cacheKey: string;
  cachePath: string;
  hit: true;
  metrics: DuplicateCodeFragment[];
};

export type DuplicateCodeCacheMiss = {
  cacheKey: string;
  cachePath: string;
  hit: false;
  reason: string;
};

export type ScanCachePayload = {
  cacheKey: string;
  codeArea: string;
  commitSha: string;
  configVersion: string;
  createdAt: string;
  inputFingerprint: CodeAreaFingerprint;
  metrics: unknown;
  normalizedToolArgs: string[];
  scanCacheVersion: string;
  scanKind: ScanKind;
  toolName: "jscpd";
  toolVersion: string;
};

export type BaselineSnapshotCacheIdentity = {
  codeAreas: Record<string, CodeAreaDefinition>;
  commitSha: string;
  configVersion: string;
  excludeDirs: string[];
  generatedFiles: string[];
  include: string[];
  jscpd: {
    defaultMinimumTokens: number;
    formatByCodeArea: Record<string, string | null>;
    minimumTokens: Record<string, number>;
  };
  toolArgs: {
    lizard: string[];
    jscpd: string[];
    scc: string[];
  };
  tools: Pick<ToolAvailability, "available" | "name" | "source" | "version">[];
};

export type BaselineSnapshotCacheHit = {
  cacheDir: string;
  cacheKey: string;
  hit: true;
  snapshot: BaselineSnapshot;
};

export type BaselineSnapshotCacheMiss = {
  cacheDir: string;
  cacheKey: string;
  hit: false;
  reason: string;
};

export type BaselineSnapshotCacheManifest = {
  cacheKey: string;
  createdAt: string;
  identity: BaselineSnapshotCacheIdentity;
  scanCacheVersion: string;
  snapshotHash: string;
};
