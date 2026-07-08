/**
 * jscpd duplicate-code detection wrapper.
 *
 * Runs the repository-managed jscpd CLI, writes a temporary config for the
 * current code-area file list, and normalizes the JSON report behind the
 * repository-owned DuplicateCodeFragment model.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ToolConfig } from "../../../model/schema.ts";
import {
  errorMessage,
  runProcess,
  runProcessSync,
  type ProcessResult
} from "../../../../../foundation/src/index.ts";
import { isMissingExplicitCommand } from "../command-path.ts";
import { parseJscpdJsonReport } from "./json-report.ts";
import type { JscpdScanResult } from "./types.ts";

export type { JscpdScanResult } from "./types.ts";
export { parseJscpdJsonReport } from "./json-report.ts";

const JSCPD_REPORT_FILE = "jscpd-report.json";
const JSCPD_PROCESS_MAX_BUFFER = 1024 * 1024 * 64;
const JSCPD_PROCESS_TIMEOUT_MS = 600_000;

export function parseJscpdVersionOutput(output: string): string {
  const match = output.trim().match(/(?:jscpd|cpd)\s+([^\s]+)/i);
  return match ? match[1] : "unknown";
}

interface ScanWithJscpdOptions {
  cwd: string;
  files: string[];
  format?: string | null;
  minimumTokens: number;
  toolConfig: ToolConfig;
}

type PreparedJscpdInvocation = {
  argv: string[];
  configPath: string;
  outputDir: string;
  tempDir: string;
};

type PreparedJscpdScan =
  | {
      cwd: string;
      invocation: PreparedJscpdInvocation;
      ok: true;
      toolConfig: ToolConfig;
    }
  | { ok: false; result: JscpdScanResult };

export function scanWithJscpd(options: ScanWithJscpdOptions): JscpdScanResult {
  const scan = prepareJscpdScan(options);
  if (!scan.ok) return scan.result;

  try {
    const child = runProcessSync(scan.toolConfig.command, scan.invocation.argv, {
      cwd: scan.cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: JSCPD_PROCESS_MAX_BUFFER,
      timeout: JSCPD_PROCESS_TIMEOUT_MS
    });

    return handleJscpdProcessResult({ child, cwd: scan.cwd, invocation: scan.invocation });
  } finally {
    cleanupTempDir(scan.invocation.tempDir);
  }
}

export async function scanWithJscpdAsync(options: ScanWithJscpdOptions): Promise<JscpdScanResult> {
  const scan = prepareJscpdScan(options);
  if (!scan.ok) return scan.result;

  try {
    const child = await runProcess({
      args: scan.invocation.argv,
      command: scan.toolConfig.command,
      cwd: scan.cwd,
      label: "jscpd",
      maxBuffer: JSCPD_PROCESS_MAX_BUFFER,
      timeout: JSCPD_PROCESS_TIMEOUT_MS,
      windowsHide: true
    });

    return handleJscpdProcessResult({ child, cwd: scan.cwd, invocation: scan.invocation });
  } finally {
    cleanupTempDir(scan.invocation.tempDir);
  }
}

function prepareJscpdScan(options: ScanWithJscpdOptions): PreparedJscpdScan {
  const {
    files,
    cwd,
    format = null,
    toolConfig,
    minimumTokens
  } = options;

  if (files.length < 2) {
    return { ok: false, result: { ok: true, fragments: [] } };
  }

  if (isMissingExplicitCommand(toolConfig.command)) {
    return {
      ok: false,
      result: {
        ok: false,
        skipped: true,
        error: `jscpd not found: ${toolConfig.command}`,
        reason: "tool-unavailable"
      }
    };
  }

  return {
    ok: true,
    cwd,
    toolConfig,
    invocation: prepareJscpdInvocation({ files, toolConfig, minimumTokens, format })
  };
}

function prepareJscpdInvocation({
  files,
  format,
  toolConfig,
  minimumTokens
}: {
  files: string[];
  format: string | null;
  minimumTokens: number;
  toolConfig: ToolConfig;
}): PreparedJscpdInvocation {
  const tempDir = mkdtempSync(join(tmpdir(), "quality-jscpd-"));
  const outputDir = join(tempDir, "report");
  const configPath = join(tempDir, ".jscpd.json");
  const config = {
    path: files,
    reporters: ["json"],
    minTokens: minimumTokens,
    minLines: 1,
    absolute: true,
    silent: true,
    noTips: true,
    ...(format ? { format: [format] } : {})
  };

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return {
    tempDir,
    outputDir,
    configPath,
    argv: [
      ...toolConfig.args,
      "--config",
      configPath,
      "--output",
      outputDir
    ]
  };
}

function handleJscpdProcessResult({
  child,
  cwd,
  invocation
}: {
  child: ProcessResult;
  cwd: string;
  invocation: PreparedJscpdInvocation;
}): JscpdScanResult {
  if (child.error) {
    return jscpdProcessError(child.error);
  }

  if (child.status !== 0 && child.status !== null) {
    return jscpdExecutionFailure(child.status, trimmedProcessOutput(child.stderr, child.stdout));
  }

  return parseJscpdReportFile(join(invocation.outputDir, JSCPD_REPORT_FILE), cwd);
}

function parseJscpdReportFile(reportPath: string, cwd: string): JscpdScanResult {
  let json: string;
  try {
    json = readFileSync(reportPath, "utf8");
  } catch (error: unknown) {
    return {
      ok: false,
      skipped: false,
      error: `jscpd JSON report missing: ${errorMessage(error)}`,
      reason: "jscpd-report-failure"
    };
  }

  if (!json.trim()) {
    return {
      ok: false,
      skipped: false,
      error: "jscpd JSON report is empty",
      reason: "jscpd-report-failure"
    };
  }

  return parseJscpdJsonReport(json, cwd);
}

function jscpdProcessError(error: Error): JscpdScanResult {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return {
      ok: false,
      skipped: true,
      error: `jscpd not found: ${error.message}`,
      reason: "tool-unavailable"
    };
  }
  return {
    ok: false,
    skipped: false,
    error: `jscpd process error: ${error.message}`,
    reason: "jscpd-execution-error"
  };
}

function jscpdExecutionFailure(status: number, output: string): JscpdScanResult {
  return {
    ok: false,
    skipped: false,
    error: `jscpd exit ${status}: ${output}`,
    reason: "jscpd-execution-error"
  };
}

function trimmedProcessOutput(stderr: string, stdout: string): string {
  return stderr.trim() || stdout.trim() || "no output";
}

function cleanupTempDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
}
