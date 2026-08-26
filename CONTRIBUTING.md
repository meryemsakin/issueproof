# Contributing to IssueProof

IssueProof should remain small, deterministic, local-first, and honest about what its evidence proves.

## Development setup

Requires Node.js 20 or newer and Git. There are no runtime dependencies.

```bash
npm install --ignore-scripts
npm test
npm run check
node bin/issueproof.js verify
```

## Change expectations

- Add tests for every verdict, normalization rule, redaction rule, schema change, and security boundary.
- Do not broaden normalization without distinct-error counterexamples; over-normalization can merge unrelated failures.
- Never persist raw environment-variable values or pre-redaction output.
- Keep deterministic observations separate from model-generated hypotheses.
- Update the JSON Schema and changelog when a public contract changes.
- Treat shell execution, uploads, source inclusion, and destructive cleanup as explicit opt-in behavior.

## Pull requests

Explain the user-facing problem, include the exact verification command, and attach an inspected IssueProof receipt when relevant. Run the full test suite before requesting review.

Security-sensitive reports, especially redaction bypasses, should follow [SECURITY.md](SECURITY.md) rather than a public issue.
