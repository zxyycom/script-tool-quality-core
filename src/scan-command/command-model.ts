export const QUALITY_SCAN_PROFILES = Object.freeze(["quick", "full"] as const);

export type QualityScanProfile = typeof QUALITY_SCAN_PROFILES[number];

export type QualityScanOptions = {
  artifactDir: string;
  baseline: string | null;
  changedFiles: string | null;
  scanProfile: QualityScanProfile;
  skipBaseline: boolean;
  topN: number;
  verificationOutput: boolean;
};

export type ChangeScope = {
  changed: boolean;
  changedFiles: string[];
};
