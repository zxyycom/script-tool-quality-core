import { isRecord, isUnknownArray } from "../../../../foundation/src/index.ts";
import { WARNING_LEVELS } from "./types.ts";

export function validateWarningChannels(warnings: unknown, errors: string[]): void {
  if (!isRecord(warnings)) {
    errors.push("warnings must be an object with all, changed, and regressions arrays");
    return;
  }

  for (const channel of ["all", "changed", "regressions"] as const) {
    const channelWarnings = warnings[channel];
    if (!isUnknownArray(channelWarnings)) {
      errors.push(`warnings.${channel} must be an array`);
      continue;
    }
    validateWarningRecords(channelWarnings, `warnings.${channel}`, errors);
  }
}

function validateWarningRecords(warnings: unknown[], prefix: string, errors: string[]): void {
  for (let i = 0; i < warnings.length; i++) {
    validateWarningRecord(warnings[i], `${prefix}[${i}]`, errors);
  }
}

function validateWarningRecord(warning: unknown, prefix: string, errors: string[]): void {
  if (!isRecord(warning)) {
    errors.push(`${prefix} must be an object`);
    return;
  }

  validateWarningLevel(warning.level, `${prefix}.level`, errors);
  requireTruthyField(warning.ruleId, `${prefix}.ruleId`, errors);
  requireTruthyField(warning.message, `${prefix}.message`, errors);
  if (warning.acceptedReason !== undefined && typeof warning.acceptedReason !== "string") {
    errors.push(`${prefix}.acceptedReason must be a string when present`);
  }
}

function validateWarningLevel(value: unknown, fieldName: string, errors: string[]): void {
  if (typeof value === "string" && WARNING_LEVELS.includes(value)) return;
  errors.push(`${fieldName}: invalid level "${value}"`);
}

function requireTruthyField(value: unknown, fieldName: string, errors: string[]): void {
  if (!value) errors.push(`${fieldName} is required`);
}
