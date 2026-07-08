# Delivery Notes

- Path: `scripts/tools/quality-core/`
- Public source entrypoint: `src/index.ts`
- Include policy: `src/**/*.ts`, `test/**/*.ts`, `README.md`, `CHANGELOG.md`, `DELIVERY.md`, `package.json`, `tsconfig.json`
- Dependency policy: source-import only from `../foundation/src/index.ts`.
- Excluded Docnav policy: default quality config, `DOCNAV_*` environment variables, `artifacts/docnav-quality`, `.cache/docnav/quality`, docs schema/example paths, and package scripts.
- Rollback: reset the subrepo pin and change `scripts/quality/scan.ts` back to the last verified local implementation.
