import { locateBaselineCommit } from "../../input/revisions.ts";
import {
  gitCommitDate as readGitCommitDate,
  gitCommitTitle as readGitCommitTitle
} from "../../../../foundation/src/index.ts";
import type { QualityScanOptions } from "../command-model.ts";
import type { QualityConfig, QualityMetrics, ToolInfo } from "../../model/schema.ts";

type ChangeScope = {
  changed: boolean;
  changedFiles: string[];
};

export function configureBaseline({
  metrics,
  config,
  opts,
  tools,
  root
}: {
  config: QualityConfig;
  metrics: QualityMetrics;
  opts: QualityScanOptions;
  root: string;
  tools: ToolInfo[];
}): void {
  if (opts.baseline) {
    metrics.baseline = createGeneratedBaseline({
      configVersion: config.version,
      commitSha: opts.baseline,
      selectionReason: "explicit",
      tools,
      root
    });
    return;
  }

  if (opts.skipBaseline) {
    console.log("Skipping baseline scan (default; use --with-baseline or --baseline <sha> to compare).");
    metrics.baseline = {
      status: "baseline-skipped",
      commitSha: null,
      commitDate: null,
      metadata: null
    };
    return;
  }

  configureAutoDetectedBaseline({ config, metrics, tools, root });
}

export function setComparisonStatus(metrics: QualityMetrics, scope: ChangeScope): void {
  if (metrics.baseline.status === "generated" && metrics.baseline.commitSha) {
    if (!scope.changed) {
      metrics.comparisonStatus = "input-unchanged";
      console.log("  Comparison: input-unchanged (text-only or non-scan-input change)");
    } else {
      metrics.comparisonStatus = "compared";
      console.log(`  Comparison: ${scope.changedFiles.length} files changed in scan scope`);
    }
  } else {
    metrics.comparisonStatus = "baseline-unavailable";
    console.log("  Comparison: baseline-unavailable");
  }
}

function configureAutoDetectedBaseline({
  config,
  metrics,
  tools,
  root
}: {
  config: QualityConfig;
  metrics: QualityMetrics;
  root: string;
  tools: ToolInfo[];
}): void {
  console.log("Locating baseline commit...");
  const baselineResult = locateBaselineCommit({
    cwd: root,
    scanInputPaths: config.include
  });

  if (!baselineResult.ok) {
    metrics.baseline = unavailableBaselineFor(baselineResult.error);
    return;
  }

  const baselineTitle = readGitCommitTitle(baselineResult.sha, root);
  console.log(`  Baseline commit: ${formatCommitLabel(baselineResult.sha, baselineTitle)} (${baselineResult.reason})`);
  metrics.baseline = createGeneratedBaseline({
    configVersion: config.version,
    commitSha: baselineResult.sha,
    selectionReason: baselineResult.reason,
    tools,
    root,
    commitDate: baselineResult.date ?? null,
    commitTitle: baselineTitle
  });
}

function unavailableBaselineFor(error: string | undefined): QualityMetrics["baseline"] {
  console.log(`  ⚠️  No baseline: ${error}`);
  return {
    status: error?.includes("no-baseline-commit")
      ? "no-baseline-commit"
      : "history-unavailable",
    commitSha: null,
    commitDate: null,
    metadata: null
  };
}

type GeneratedBaselineOptions = {
  commitDate?: string | null;
  commitSha: string;
  commitTitle?: string | null;
  configVersion: string;
  root: string;
  selectionReason: string;
  tools: ToolInfo[];
};

function createGeneratedBaseline(options: GeneratedBaselineOptions): QualityMetrics["baseline"] {
  const {
    commitSha,
    selectionReason,
    tools,
    root,
    commitDate = null,
    commitTitle = null
  } = options;
  const resolvedDate = commitDate || readGitCommitDate(commitSha, root);
  const resolvedTitle = commitTitle || readGitCommitTitle(commitSha, root);
  return {
    status: "generated",
    commitSha,
    commitDate: resolvedDate,
    metadata: {
      commitSha,
      commitDate: resolvedDate || "unknown",
      commitTitle: resolvedTitle,
      selectionReason,
      configVersion: options.configVersion,
      toolMetadata: tools
    }
  };
}

function formatCommitLabel(sha: string, title: string | null): string {
  return title ? `${sha} - ${title}` : sha;
}
