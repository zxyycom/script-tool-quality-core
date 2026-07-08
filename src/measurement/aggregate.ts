/**
 * Code quality aggregate builders.
 *
 * Keeps summary math separate from CLI orchestration and tool wrappers.
 */

import type {
  AggregateMetrics,
  DuplicateCodeFragment,
  FileMetric,
  FunctionMetric,
  LanguageAggregate,
  QualityConfig
} from "../model/schema.ts";
import { buildCodeAreaAggregates } from "./aggregate/area.ts";
import { buildOverallAggregates } from "./aggregate/overall.ts";

export function buildAggregates({
  fileMetrics,
  functionMetrics,
  duplicateCode,
  byLanguage,
  config
}: {
  byLanguage: LanguageAggregate[];
  config: QualityConfig;
  duplicateCode: DuplicateCodeFragment[];
  fileMetrics: FileMetric[];
  functionMetrics: FunctionMetric[];
}): AggregateMetrics {
  const areaAggMap = buildCodeAreaAggregates({
    config,
    duplicateCode,
    fileMetrics,
    functionMetrics
  });

  return {
    byLanguage,
    byCodeArea: Array.from(areaAggMap.values()).sort((a, b) => b.lines - a.lines),
    overall: buildOverallAggregates({ fileMetrics, functionMetrics, duplicateCode })
  };
}
