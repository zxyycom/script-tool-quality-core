type GitGlobPathspecArgsOptions = {
  omitWhenEmpty?: boolean;
};

export function gitGlobPathspecs(patterns: readonly string[]): string[] {
  return patterns.map((pattern) => `:(glob)${pattern}`);
}

export function gitGlobPathspecArgs(
  patterns: readonly string[],
  options: GitGlobPathspecArgsOptions = {}
): string[] {
  const pathspecs = gitGlobPathspecs(patterns);
  if (pathspecs.length === 0 && options.omitWhenEmpty) {
    return [];
  }
  return ["--", ...pathspecs];
}
