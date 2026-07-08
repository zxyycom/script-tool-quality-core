/**
 * scc 仓库/文件级指标 wrapper。
 *
 * 封装 scc 调用，统一输出仓库体量、语言占比、文件总行数/代码行数、文件级 decision-token count、
 * 路径和排序。
 */

import type { ToolConfig } from "../../model/schema.ts";
import { runProcessSync } from "../../../../foundation/src/index.ts";
import { parseSccCSV, type SccScanResult } from "./scc/parser.ts";

export { SCC_VERSION, SCC_VERSION_OUTPUT, SCC_BY_FILE_CSV_HEADER, parseSccCSV } from "./scc/parser.ts";

interface ScanWithSccOptions {
  cwd: string;
  excludeDirs: string[];
  includePaths: string[];
  toolConfig: ToolConfig;
}

export function scanWithScc({ cwd, includePaths, excludeDirs, toolConfig }: ScanWithSccOptions): SccScanResult {
  const argv = buildSccArgs({ includePaths, excludeDirs, toolArgs: toolConfig.args });

  const child = runProcessSync(toolConfig.command, argv, {
    cwd,
    timeout: 300_000
  });

  if (child.error) {
    return {
      ok: false,
      error: `scc process error: ${child.error.message}`
    };
  }

  if (child.status !== 0 && child.status !== null) {
    const stderr = (child.stderr || "").trim();
    const stdout = (child.stdout || "").trim();
    return {
      ok: false,
      error: `scc exit ${child.status}: ${stderr || stdout || "no output"}`
    };
  }

  const output = child.stdout || "";
  return parseSccCSV(output, cwd);
}

export function buildSccArgs({
  includePaths,
  excludeDirs,
  toolArgs
}: {
  excludeDirs: string[];
  includePaths: string[];
  toolArgs: string[];
}): string[] {
  const excludeArgs = excludeDirs.flatMap((d) => ["--exclude-dir", d]);
  return [...toolArgs, "--by-file", "--format", "csv", ...excludeArgs, ...includePaths];
}
