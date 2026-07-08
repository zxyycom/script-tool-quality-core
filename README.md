# quality-core

Quality scanning core for TypeScript script tooling.

## Use

Import from `src/index.ts`.

This repository provides quality schema/types, code-area classification, scanner adapters, metrics aggregation, warnings, reports, baseline/cache primitives, and `runQualityScan`. Callers provide repository-specific paths, globs, thresholds, tools, and scan options through typed config.

## Checks

- `bun run typecheck`
- `bun run lint`
- `bun run test`
