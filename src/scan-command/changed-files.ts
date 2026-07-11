import { getChangedFileList, type ChangedFilesOptions } from "../input/files.ts";
import type { ChangeScope } from "./command-model.ts";
import type { QualityConfig } from "../model/schema.ts";

export type ResolveChangedFilesForScanOptions = {
  collectChangedFiles?: (opts: ChangedFilesOptions, rootDir: string) => string[];
  config?: Pick<QualityConfig, "include">;
  opts: Pick<ChangedFilesOptions, "changedFiles">;
  root: string;
  scope: ChangeScope;
};

export function resolveChangedFilesForScan(options: ResolveChangedFilesForScanOptions): string[] {
  const {
    opts,
    config,
    root,
    scope,
    collectChangedFiles = getChangedFileList
  } = options;
  const changedFileOptions = { ...opts, scanInputPaths: config?.include ?? [] };
  if (opts.changedFiles) {
    return collectChangedFiles(changedFileOptions, root);
  }

  if (scope.changedFiles.length > 0 || !scope.changed) {
    return scope.changedFiles;
  }

  return collectChangedFiles(changedFileOptions, root);
}
