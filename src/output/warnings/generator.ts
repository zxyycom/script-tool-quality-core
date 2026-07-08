/**
 * Warning 规则生成器。
 *
 * 使用当前快照、可选 changed scope、可选 baseline delta 和绝对下限组合
 * 生成 warning records。默认聚焦全量观测报告；只有启用 comparison 时
 * 才生成 changed/regression CI annotation 输入。
 */

import type {
  WarningChannels,
  WarningRecord
} from "../../model/schema.ts";
import { buildWarningContext } from "./baseline-context.ts";
import {
  compareWarnings,
  shouldEmitChangedWarning,
  suppressesChangedWarnings
} from "./channels.ts";
import type { GenerateWarningsParams } from "./warning-model.ts";
import { applyAcceptedWarningReasons } from "./accepted-warnings.ts";
import { generateDuplicateWarnings } from "./duplicate-warnings.ts";
import { generateFileWarnings } from "./file-warnings.ts";
import { generateFunctionWarnings } from "./function-warnings.ts";

export function generateWarningChannels(params: GenerateWarningsParams): WarningChannels {
  const { files, functions, duplicates, config, baseline, comparisonStatus } = params;

  const context = buildWarningContext(config, baseline);
  const candidates = [
    ...generateFileWarnings(files, context),
    ...generateFunctionWarnings(functions, context),
    ...generateDuplicateWarnings(duplicates, context)
  ];

  candidates.sort((a, b) => compareWarnings(a.record, b.record));

  const all = candidates.map((candidate) => candidate.record);
  const changedCandidates = suppressesChangedWarnings(comparisonStatus)
    ? []
    : candidates.filter(shouldEmitChangedWarning);

  return applyAcceptedWarningReasons({
    all,
    changed: changedCandidates.map((candidate) => candidate.record),
    regressions: changedCandidates
      .filter((candidate) => candidate.record.deltaValue !== null && candidate.record.deltaValue > candidate.deltaFloor)
      .map((candidate) => candidate.record)
  }, config.acceptedWarnings ?? [], { warnOnUnmatched: params.validateAcceptedWarnings ?? false });
}

export function generateWarnings(params: GenerateWarningsParams): WarningRecord[] {
  return generateWarningChannels(params).changed;
}
