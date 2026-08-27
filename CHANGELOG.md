# Changelog

All notable changes are documented here. The project follows semantic versioning after the first public release; pre-release schemas may still change with an explicit version bump.

## Unreleased

## 0.3.0 — 2026-08-27

- Add optional per-attempt Git worktree isolation from committed `HEAD`.
- Terminate timed-out POSIX process groups and Windows process trees, including descendant workers.
- Add an adversarial failure-fingerprint regression corpus with explicit merge/separation decisions.
- Make named issue-evidence checks primary and label the retained numeric score as uncalibrated.
- Add external dogfood, case-study, and launch-readiness gates.

## 0.2.1 — 2026-08-26

- Verify the core CLI and composite Action across Linux, macOS, and Windows.
- Add executable Node.js, Python, and Go examples plus a real-output terminal demo.
- Describe receipt SHA-256 values accurately as integrity checksums, not signatures or tamper-proof seals.
- Refresh installation and publication guidance now that the npm package is live.

## 0.2.0 — 2026-08-26

- Add strict, argv-based `.issueproof.json` project contracts.
- Add `issueproof init` with credential-looking argument refusal and overwrite protection.
- Add config-based `verify` and machine-readable `--json` summaries.
- Add integrity-checked `issueproof compare` for cross-commit and cross-machine observations.
- Add a composite GitHub Action with receipt artifacts and verdict outputs.
- Require at least two executions for a stability claim.
- Distinguish command startup errors from observed program failures.
- Expand the suite to config, comparison, tamper, and Git-contamination cases.
- Validate the packaged CLI entry and run tests automatically before npm publication.

## 0.1.0 — 2026-08-26

- Initial deterministic reproduction verifier.
- Repeated-run classification, bounded capture, redaction, issue evidence checks, Git contamination detection, and integrity-checked JSON/Markdown receipts.
