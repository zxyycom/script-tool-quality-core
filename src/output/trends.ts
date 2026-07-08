/**
 * Code quality trend delta generation.
 */

import type {
  BaselineSnapshot,
  QualityMetrics,
  TrendDelta
} from "../model/schema.ts";
import { fingerprintTrends } from "./trends/fingerprints.ts";
import {
  codeAreaTrends,
  languageTrends,
  overallTrends
} from "./trends/trend-lines.ts";

export function generateTrends(metrics: QualityMetrics, baselineSnapshot: BaselineSnapshot): TrendDelta[] {
  const current = metrics.aggregates.overall;
  const baseline = baselineSnapshot.aggregates.overall;

  return [
    ...overallTrends(current, baseline),
    ...languageTrends({
      currentLanguages: metrics.aggregates.byLanguage || [],
      baselineLanguages: baselineSnapshot.aggregates.byLanguage,
      currentOverall: current,
      baselineOverall: baseline
    }),
    ...codeAreaTrends(metrics.aggregates.byCodeArea || [], baselineSnapshot.aggregates.byCodeArea),
    ...fingerprintTrends(metrics.currentFingerprints, baselineSnapshot.fingerprints)
  ];
}
