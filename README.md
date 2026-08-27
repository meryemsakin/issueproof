# IssueProof

**Prove that a bug reproduction is stable before handing it to a human or coding agent.**

[![npm](https://img.shields.io/npm/v/issueproof)](https://www.npmjs.com/package/issueproof)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-IssueProof-blue?logo=github)](https://github.com/marketplace/actions/issueproof)
[![CI](https://github.com/meryemsakin/issueproof/actions/workflows/ci.yml/badge.svg)](https://github.com/meryemsakin/issueproof/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An issue can look reproducible and still be a poor unit of work. The command may pass on the next run, fail with a different signature, or change the checkout that later attempts depend on. Handing that evidence directly to a maintainer or coding agent wastes time on an unstable premise.

IssueProof runs the exact command repeatedly, compares normalized failure signatures, watches tracked Git state, and writes reviewable JSON and Markdown receipts. It answers one deliberately narrow question:

> Is this exact reproduction stable enough to hand off?

It does not diagnose the root cause, decide that a bug is new, or claim that an absent failure is fixed.

![IssueProof terminal demo](https://raw.githubusercontent.com/meryemsakin/issueproof/main/docs/assets/issueproof-demo.gif)

## Quick start

```bash
# Run without installing
npx issueproof verify --runs 3 -- npm test

# Or install the CLI globally
npm install --global issueproof

# Create and re-run a reviewable, argv-based reproduction contract
issueproof init --issue issue.md -- npm test
issueproof verify
```

Example result:

```text
stable_failure: The same failure occurred in all 3 runs.
Receipt: .issueproof/receipts/<id>/receipt.md
Machine-readable: .issueproof/receipts/<id>/receipt.json
```

## Evidence from a real repository

At an immutable [GJSON commit](https://github.com/tidwall/gjson/commit/7d8b3821e9d2acf35e8a226b63fcf801078e9b96), IssueProof recorded this control matrix for `TestJSONString`:

| Runtime/control | Result |
| --- | --- |
| Go 1.27.0 | `stable_failure`, 5/5 attempts |
| Go 1.26.2 | `verified_pass`, 2/2 attempts |
| Go 1.27.0 with `GOEXPERIMENT=nojsonv2` | `verified_pass`, 2/2 attempts |

The controls isolated a Go-version-specific exact-output difference. They did not establish a new Go regression: the Go json/v2 working group had already reviewed the behavior and retained it as a non-semantic encoding change. The [case study and receipts](docs/case-studies/external-matrix-2026-08-27/README.md#gjson-control-matrix) preserve the commands, environment, results, and limitations; the downstream test question is tracked in [tidwall/gjson#397](https://github.com/tidwall/gjson/issues/397).

## Why this is different

Environment collectors and support-bundle tools answer “what happened on this machine?” IssueProof answers a narrower question that those bundles do not prove:

> Does this exact evidence reproduce consistently enough to become a trustworthy debugging task?

It keeps two claims separate:

1. **Runtime proof:** Did the command fail in the same way across repeated attempts?
2. **Issue evidence:** Does the accompanying report contain observed/expected behavior, reproduction steps, environment, frequency, localization cues, and a possible repair direction?

The first is measured by execution. The second is a transparent heuristic. IssueProof never combines them into a misleading “AI confidence” number.

## Current scope

Version 0.3 targets reproducible CLI, test, and build failures. It deliberately does not claim to reproduce GUI flows, production-only incidents, distributed races, or root causes.

Verdicts include:

- `stable_failure`: every run failed with the same normalized signature
- `divergent_failure`: every run failed, but the failure signatures differed
- `flaky`: the command both passed and failed
- `not_reproduced`: an expected failure did not occur
- `contaminated`: the command changed tracked Git state during verification
- `timed_out`: at least one attempt exceeded its timeout
- `isolation_error`: an isolated attempt could not be cleaned up safely
- `verified_pass`: every run passed when `--expect pass` was requested

## Commands

```bash
# Create .issueproof.json without shell-string ambiguity
issueproof init --issue issue.md -- npm test

# Verify the committed config
issueproof verify

# Verify an expected failure (three runs by default)
issueproof verify --no-config -- npm test

# Run five attempts and assess an existing issue description
issueproof verify --runs 5 --issue issue.md -- npm test -- parser.test.ts

# Start every attempt from committed HEAD in a temporary Git worktree
issueproof verify --isolation worktree --runs 5 -- npm test -- parser.test.ts

# Verify an expected success
issueproof verify --expect pass -- npm run build

# Inspect issue evidence without executing code
issueproof assess issue.md

# Detect whether a JSON receipt was edited after generation
issueproof check .issueproof/receipts/<id>/receipt.json

# Compare observations from two commits or machines
issueproof compare before/receipt.json after/receipt.json

# Stable JSON summary for scripts and CI
issueproof verify --json
```

Run `issueproof --help` for all limits and options.

## Project contract

`.issueproof.json` is intentionally small and safe to review in a pull request:

```json
{
  "schemaVersion": "1.0",
  "command": ["npm", "test", "--", "parser.test.ts"],
  "expect": "fail",
  "runs": 3,
  "timeoutSeconds": 60,
  "maxOutputKb": 64,
  "issue": "issue.md",
  "output": ".issueproof/receipts",
  "cwd": ".",
  "isolation": "worktree"
}
```

The command is an argv array, not a shell string. Paths in the config are resolved relative to the config file. CLI flags override config values, and an explicit command after `--` overrides only the configured command.

`tracked` isolation observes the current checkout and stops when a command changes tracked Git state. `worktree` isolation requires a clean tracked checkout and creates a detached temporary worktree from committed `HEAD` for every attempt. Tracked mutations inside one isolated attempt are recorded but cannot affect the next attempt. Worktrees do not isolate ignored files outside the checkout, global caches, services, ports, databases, containers, or processes that deliberately detach into a new process group.

IssueProof refuses to load or create a config containing credential-looking argv values. Authentication should come from the child process environment or an external credential helper; environment values are never written to receipts.

## Comparing receipts

`issueproof compare` verifies both receipt integrity checksums before comparing them. It reports whether the same failure signature persists, disappears, appears, or changes across commits/machines. “Failure absent” is intentionally not called “fixed”: it is evidence for this exact command and environment, not proof of a root-cause repair.

The SHA-256 checksum detects a receipt changed without its checksum being refreshed. It is not a digital signature or proof of authorship; anyone who can edit a receipt can recompute it.

Receipts with redacted command arguments are marked incomparable because two different secrets would otherwise look like the same command.

## GitHub Action

The repository includes a composite [`action.yml`](action.yml). Use a full commit SHA or a trusted release tag:

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: actions/setup-node@v7
    with:
      node-version: 24
  - id: issueproof
    uses: meryemsakin/issueproof@v0.3.0
    with:
      config: .issueproof.json
```

Release tags are convenient for evaluation; pin a reviewed full commit SHA in production. The Action uploads the receipt even when verification fails, exposes `verdict`, `verified`, and `receipt-path` outputs, then preserves IssueProof's exit status. It uses the config's direct argv execution by default. The optional `command` input is explicitly executed through `bash -lc`; never populate it from issue bodies, PR titles, comments, branch names, or other untrusted input. GitHub's own [composite-action guidance](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action) gives the same warning about untrusted contexts.

## Safety defaults

- No shell is inserted between IssueProof and the command. Shell syntax requires an explicit `sh -lc` or equivalent.
- Config files store argv arrays and reject credential-looking arguments.
- Nothing is uploaded. Receipts remain under `.issueproof/` unless another output directory is chosen.
- Full environment-variable values are never persisted.
- Common credentials, bearer tokens, private keys, home paths, and repository paths are redacted before persistence.
- Output is bounded and stores the head and tail when the limit is exceeded.
- Timed-out commands are terminated as a POSIX process group or a Windows process tree so ordinary test workers do not leak into later attempts.
- Report files are created with owner-only permissions where the operating system supports them.
- In default `tracked` mode, verification stops if the command changes tracked repository state; IssueProof does not silently revert user files.
- Optional `worktree` mode removes each temporary checkout after its attempt and fails closed if cleanup cannot be confirmed.

Redaction is defense in depth, not a guarantee. Inspect a receipt before sharing it.

## Development

Requires Node.js 20 or newer and has no runtime dependencies.

```bash
npm test
npm run check
node bin/issueproof.js verify
```

The reproducible [Node.js, Python, and Go examples](https://github.com/meryemsakin/issueproof/tree/main/examples/polyglot) exercise the same language-agnostic receipt flow. CI runs the core suite on Linux, macOS, and Windows, then verifies the composite Action end to end on all three runner families.

The research and product boundary are documented in [docs/research.md](docs/research.md); architectural decisions and the AI extension boundary are in [docs/architecture.md](docs/architecture.md). External dogfood evidence includes the [PyTorch case study](docs/case-studies/pytorch-192284/README.md) and a [ten-repository compatibility matrix](docs/case-studies/external-matrix-2026-08-27/README.md). Every study follows the reviewable template in [docs/case-studies/README.md](docs/case-studies/README.md), and broad promotion is gated by [docs/launch-readiness.md](docs/launch-readiness.md).

## Support

Usage questions and suspected bugs follow [SUPPORT.md](SUPPORT.md). Security-sensitive reports, especially possible redaction bypasses, must follow [SECURITY.md](SECURITY.md) instead of a public issue. IssueProof is a public alpha with no guaranteed support SLA.

## Status

This is an evidence-backed v0.3 public alpha. The CLI is published as [`issueproof` on npm](https://www.npmjs.com/package/issueproof), and the composite Action is available in the [GitHub Marketplace](https://github.com/marketplace/actions/issueproof).

## License

MIT
