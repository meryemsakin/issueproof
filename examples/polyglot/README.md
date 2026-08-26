# Polyglot examples

IssueProof verifies processes, not test frameworks. These three programs emit the same deterministic failure while including a volatile timestamp and process ID. The receipt normalizer removes those volatile values before comparing failure signatures.

Run the examples from the repository root:

```bash
# Node.js
npx issueproof verify --runs 3 -- node examples/polyglot/stable-failure.js

# Python
npx issueproof verify --runs 3 -- python3 examples/polyglot/stable_failure.py

# Go
npx issueproof verify --runs 3 -- go run examples/polyglot/stable_failure.go
```

Each command should produce `stable_failure`, even though the timestamp and PID change on every attempt. CI executes all three examples and validates their JSON receipts.
