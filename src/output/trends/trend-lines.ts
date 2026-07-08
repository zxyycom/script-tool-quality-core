import type {
  AggregateMetrics,
  CodeAreaAggregate,
  LanguageAggregate,
  TrendDelta
} from "../../model/schema.ts";
import {
  codeAreaTrendSpecs,
  makeTrend,
  numberOrNull,
  overallTrendSpecs,
  percentOf
} from "./trend-model.ts";

export function overallTrends(
  current: AggregateMetrics["overall"],
  baseline: AggregateMetrics["overall"]
): TrendDelta[] {
  return overallTrendSpecs.map(([metric, field, unit]) =>
    makeTrend(metric, numberOrNull(current[field]), numberOrNull(baseline[field]), unit)
  );
}

export function languageTrends({
  currentLanguages,
  baselineLanguages,
  currentOverall,
  baselineOverall
}: {
  baselineLanguages: LanguageAggregate[];
  baselineOverall: AggregateMetrics["overall"];
  currentLanguages: LanguageAggregate[];
  currentOverall: AggregateMetrics["overall"];
}): TrendDelta[] {
  const baselineByLanguage = new Map<string, LanguageAggregate>();
  for (const lang of baselineLanguages) {
    baselineByLanguage.set(lang.language, lang);
  }

  const trends: TrendDelta[] = [];
  for (const lang of currentLanguages) {
    const baselineLanguage = baselineByLanguage.get(lang.language);
    if (!baselineLanguage) continue;

    trends.push(makeTrend(`lang-${lang.language}-files`, lang.files, baselineLanguage.files, "files"));
    trends.push(makeTrend(`lang-${lang.language}-lines`, lang.lines, baselineLanguage.lines, "lines"));
    trends.push(makeTrend(
      `lang-${lang.language}-share`,
      percentOf(lang.codeLines || 0, currentOverall.totalCodeLines || 0),
      percentOf(baselineLanguage.codeLines || 0, baselineOverall.totalCodeLines || 0),
      "percent"
    ));
  }
  return trends;
}

export function codeAreaTrends(
  currentAreas: CodeAreaAggregate[],
  baselineAreas: CodeAreaAggregate[]
): TrendDelta[] {
  const baselineByArea = new Map<string, CodeAreaAggregate>();
  for (const area of baselineAreas) {
    baselineByArea.set(area.codeArea, area);
  }

  const trends: TrendDelta[] = [];
  for (const area of currentAreas) {
    const baselineArea = baselineByArea.get(area.codeArea);
    if (!baselineArea) continue;

    for (const [metric, field, unit] of codeAreaTrendSpecs) {
      trends.push(makeTrend(
        `area-${area.codeArea}-${metric}`,
        numberOrNull(area[field]),
        numberOrNull(baselineArea[field]),
        unit
      ));
    }
  }
  return trends;
}
