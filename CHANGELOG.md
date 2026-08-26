# Changelog

All notable changes are documented here. The project follows semantic versioning after the first public release; pre-release schemas may still change with an explicit version bump.

## 0.2.0 — 2026-08-26

- Add strict, argv-based `.issueproof.json` project contracts.
- Add `issueproof init` with credential-looking argument refusal and overwrite protection.
- Add config-based `verify` and machine-readable `--json` summaries.
- Add seal-checked `issueproof compare` for cross-commit and cross-machine observations.
- Add a composite GitHub Action with receipt artifacts and verdict outputs.
- Require at least two executions for a stability claim.
- Distinguish command startup errors from observed program failures.
- Expand the suite to config, comparison, tamper, and Git-contamination cases.

## 0.1.0 — 2026-08-26

- Initial deterministic reproduction verifier.
- Repeated-run classification, bounded capture, redaction, issue evidence checks, Git contamination detection, and sealed JSON/Markdown receipts.
