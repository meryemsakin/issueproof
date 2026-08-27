# Architecture

## Product boundary

IssueProof is a **reproduction verifier**, not a general log collector, issue tracker, autonomous fixer, or observability platform. Its source of truth is an executable observation receipt.

```text
command + optional issue text
          |
          v
  bounded execution (N runs) ---- Git state before/after
          |                         optional worktree per attempt
          |
          v
 normalize -> redact -> fingerprint
          |
          +---- deterministic verdict
          +---- transparent issue-evidence checks
          |
          v
 canonical receipt -> SHA-256 integrity checksum -> JSON + Markdown
```

## Design principles

1. **Evidence before inference.** Exit codes, timing, output signatures, and state changes are observations. Root-cause guesses are not.
2. **Two independent readiness axes.** Runtime reproducibility and issue content are reported separately.
3. **Redact before persistence.** Raw captured output exists only in process memory and is redacted before report construction.
4. **No hidden remote behavior.** Version 0.1 has no network calls or upload path.
5. **Fail closed on contaminated trials.** Default tracked mode stops on tracked mutation; worktree mode records and contains it. Failed isolation cleanup cannot produce a verified claim.
6. **Schema first.** JSON is the contract; Markdown is a deterministic view.

## Modules

| Module | Responsibility |
| --- | --- |
| `process.js` | Direct child-process execution, process-tree timeout, bounded capture |
| `git.js` | Commit and tracked-working-tree fingerprints |
| `isolation.js` | Detached per-attempt Git worktrees and fail-closed cleanup |
| `redact.js` | ANSI removal and persistence-boundary secret/path redaction |
| `fingerprint.js` | Volatile-value normalization and failure signature hashing |
| `classify.js` | Deterministic verdict state machine |
| `readiness.js` | Explainable issue-evidence checklist |
| `integrity.js` | Canonical serialization and receipt checksum verification |
| `config.js` | Strict config parsing, relative-path resolution, credential-risk gate |
| `compare.js` | Integrity-checked cross-receipt observation comparison |
| `verify.js` | Orchestration and schema assembly |
| `report.js` | JSON and Markdown persistence |
| `cli.js` | User-facing command contract and exit codes |

## Receipt semantics

The SHA-256 integrity checksum detects a receipt changed without its checksum being refreshed. It is **not tamper-proof and not a digital signature**: anyone able to edit the receipt can recompute the checksum. A later attestation mode can add Sigstore/in-toto signing without breaking the v1 observation model.

Failure fingerprints normalize a deliberately small set of volatile values such as timestamps, process IDs, UUIDs, memory addresses, and durations. Over-normalization would merge distinct bugs, so normalization rules grow only with reviewed equivalence and separation fixtures in the adversarial corpus. Random ports and domain identifiers remain distinct until framework-specific evidence justifies a narrower rule.

Issue readiness is checklist-first. Observed behavior, expected behavior, reproduction steps, environment, and frequency are required human-handoff evidence; localization and repair direction are optional agent context. The retained weighted score is explicitly uncalibrated and is not the readiness gate.

## AI extension boundary

The MVP intentionally uses no model. A future `Analyzer` adapter may consume only a validated, redacted receipt and return schema-constrained suggestions with provenance:

```text
validated receipt
  -> completeness questions
  -> likely code locations (retrieval)
  -> duplicate candidates (retrieval)
  -> repair hypothesis (clearly labeled inference)
```

The model must never rewrite observations, change the deterministic verdict, access raw pre-redaction output, or silently upload a receipt. Model/provider/version and evidence references must be recorded with every inference.

## Evaluation plan

- **Redaction:** use adversarial secret fixtures plus de-identified traceback corpora.
- **Readiness checks:** label a stratified GitBugs sample and report per-check precision/recall, not just an aggregate score.
- **Agent usefulness:** ablate receipt fields on SWE-bench Verified and measure resolved-task delta across multiple agent/model combinations.
- **Retrieval:** evaluate suspected-file suggestions on SWEbenchCodeRetrieval.
- **Stability:** create fixtures for timestamps, randomized ports, PIDs, ordering changes, flaky exit codes, timeouts, and stateful tests.

## Next milestones

1. v0.3: external dogfood receipts, worktree/process-tree hardening, and JUnit/TAP adapters.
2. v0.4: signed receipts and a container recipe adapter for stronger cross-machine claims.
3. v0.5: optional local/BYOK retrieval for localization and duplicate suggestions, evaluated before release.
4. v1.0: schema stability, calibrated public evaluation, and signed release artifacts.
