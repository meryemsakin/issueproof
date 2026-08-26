# IssueProof

**Prove that a bug reproduction is stable before handing it to a human or coding agent.**

IssueProof runs an exact reproduction command multiple times, compares normalized failure signatures, detects repository-state contamination, redacts common secrets, and emits a tamper-evident JSON and Markdown receipt.

```bash
# Create a reviewable, argv-based reproduction contract
issueproof init --issue issue.md -- npm test

# Re-run the contract at any time
issueproof verify
```

Example result:

```text
stable_failure: The same failure occurred in all 3 runs.
Receipt: .issueproof/receipts/<id>/receipt.md
Machine-readable: .issueproof/receipts/<id>/receipt.json
```

## Why this is different

Environment collectors and support-bundle tools answer “what happened on this machine?” IssueProof answers a narrower question that those bundles do not prove:

> Does this exact evidence reproduce consistently enough to become a trustworthy debugging task?

It keeps two claims separate:

1. **Runtime proof:** Did the command fail in the same way across repeated attempts?
2. **Issue evidence:** Does the accompanying report contain observed/expected behavior, reproduction steps, environment, frequency, localization cues, and a possible repair direction?

The first is measured by execution. The second is a transparent heuristic. IssueProof never combines them into a misleading “AI confidence” number.

## Current scope

Version 0.2 targets reproducible CLI, test, and build failures. It deliberately does not claim to reproduce GUI flows, production-only incidents, distributed races, or root causes.

Verdicts include:

- `stable_failure`: every run failed with the same normalized signature
- `divergent_failure`: every run failed, but the failure signatures differed
- `flaky`: the command both passed and failed
- `not_reproduced`: an expected failure did not occur
- `contaminated`: the command changed tracked Git state during verification
- `timed_out`: at least one attempt exceeded its timeout
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
  "cwd": "."
}
```

The command is an argv array, not a shell string. Paths in the config are resolved relative to the config file. CLI flags override config values, and an explicit command after `--` overrides only the configured command.

IssueProof refuses to load or create a config containing credential-looking argv values. Authentication should come from the child process environment or an external credential helper; environment values are never written to receipts.

## Comparing receipts

`issueproof compare` verifies both receipt seals before comparing them. It reports whether the same failure signature persists, disappears, appears, or changes across commits/machines. “Failure absent” is intentionally not called “fixed”: it is evidence for this exact command and environment, not proof of a root-cause repair.

Receipts with redacted command arguments are marked incomparable because two different secrets would otherwise look like the same command.

## GitHub Action

The repository includes a composite [`action.yml`](action.yml). After the project is published, use a full commit SHA or trusted release tag:

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: actions/setup-node@v6
    with:
      node-version: 24
  - id: issueproof
    uses: meryemsakin/issueproof@main
    with:
      config: .issueproof.json
```

`@main` is convenient during alpha development; pin a reviewed full commit SHA in production. The Action uploads the receipt even when verification fails, exposes `verdict`, `verified`, and `receipt-path` outputs, then preserves IssueProof's exit status. It uses the config's direct argv execution by default. The optional `command` input is explicitly executed through `bash -lc`; never populate it from issue bodies, PR titles, comments, branch names, or other untrusted input. GitHub's own [composite-action guidance](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action) gives the same warning about untrusted contexts.

## Safety defaults

- No shell is inserted between IssueProof and the command. Shell syntax requires an explicit `sh -lc` or equivalent.
- Config files store argv arrays and reject credential-looking arguments.
- Nothing is uploaded. Receipts remain under `.issueproof/` unless another output directory is chosen.
- Full environment-variable values are never persisted.
- Common credentials, bearer tokens, private keys, home paths, and repository paths are redacted before persistence.
- Output is bounded and stores the head and tail when the limit is exceeded.
- Report files are created with owner-only permissions where the operating system supports them.
- Verification stops if the command changes tracked repository state; IssueProof does not silently revert user files.

Redaction is defense in depth, not a guarantee. Inspect a receipt before sharing it.

## Development

Requires Node.js 20 or newer and has no runtime dependencies.

```bash
npm test
npm run check
node bin/issueproof.js verify
```

The research and product boundary are documented in [docs/research.md](docs/research.md); architectural decisions and the AI extension boundary are in [docs/architecture.md](docs/architecture.md).

## Status

This is an evidence-backed v0.2 alpha, not yet a published npm package or GitHub Action. The `issueproof` npm name was unclaimed when checked on 26 August 2026, but registry availability is not a trademark clearance.

## License

MIT
