# quality-core

Docnav-neutral quality observability core for quality schema/types, code-area classification, scanner adapters/parsers, metrics aggregation, warning/report generation, baseline/cache primitives, and `runQualityScan`.

## Public Source Entrypoint

- `src/index.ts`

Callers must provide repository root, artifact/cache paths, include/exclude globs, code areas, thresholds, accepted warnings, tool commands, scan options, and output preferences through typed config/options. This manifest is private tooling metadata and is not an npm publish contract.

## Runtime Prerequisites

- Bun for tests and script execution.
- `tsgo` and ESLint from the parent workspace dependencies.
- Tool commands supplied by the caller config for Lizard, scc, and jscpd when running scans.
- A pinned `scripts/tools/foundation/` checkout adjacent to this toolkit.

## Verification

- `bun run --cwd scripts/tools/quality-core typecheck`
- `bun run --cwd scripts/tools/quality-core lint`
- `bun run --cwd scripts/tools/quality-core test`

## Integration

Docnav keeps `scripts/quality/config.ts` and `scripts/quality/args.ts` as Docnav-owned defaults. `scripts/quality/scan.ts` passes those typed values into `runQualityScan`.
