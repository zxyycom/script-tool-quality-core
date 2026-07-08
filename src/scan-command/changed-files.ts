import { getChangedFileList, type ChangedFilesOptions } from "../input/files.ts";
import type { ChangeScope } from "./command-model.ts";
import type { QualityConfig } from "../model/schema.ts";

export function resolveChangedFilesForScan({
  opts,
  config,
  root,
  scope,
  collectChangedFiles = getChangedFileList
}: {
  collectChangedFiles?: (opts: ChangedFilesOptions, rootDir: string) => string[];
  config?: Pick<QualityConfig, "include">;
  opts: Pick<ChangedFilesOptions, "changedFiles">;
  root: string;
  scope: ChangeScope;
}): string[] {
  const changedFileOptions = { ...opts, scanInputPaths: config?.include ?? [] };
  if (opts.changedFiles) {
    return collectChangedFiles(changedFileOptions, root);
  }

  if (scope.changedFiles.length > 0 || !scope.changed) {
    return scope.changedFiles;
  }

  return collectChangedFiles(changedFileOptions, root);
}
