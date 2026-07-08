import type {
  CodeAreaFingerprint,
  TrendDelta
} from "../../model/schema.ts";
import { makeTrend } from "./trend-model.ts";

export function fingerprintTrends(
  currentFingerprints: Record<string, CodeAreaFingerprint>,
  baselineFingerprints: Record<string, CodeAreaFingerprint>
): TrendDelta[] {
  const trends: TrendDelta[] = [];

  for (const [area, baselineFingerprint] of Object.entries(baselineFingerprints)) {
    const currentFingerprint = currentFingerprints[area];
    if (!currentFingerprint) continue;

    trends.push(makeTrend(
      `area-${area}-files`,
      currentFingerprint.fileCount,
      baselineFingerprint.fileCount,
      "files"
    ));
    trends.push(makeTrend(
      `area-${area}-fingerprint-changed`,
      currentFingerprint.fingerprint !== baselineFingerprint.fingerprint ? 1 : 0,
      0,
      "boolean"
    ));
  }
  return trends;
}
