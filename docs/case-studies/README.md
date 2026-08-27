# External dogfood case studies

Case studies are evidence records, not testimonials. A study is publishable only when another person can inspect the exact upstream revision, command, environment, IssueProof version, and integrity-checked receipt.

## Published studies

- [PyTorch #192284: stable Dynamo failure on Python 3.14](pytorch-192284/README.md) — five isolated attempts at an immutable test-tree commit, including the receipt and the limitation that the runtime wheel did not match the source checkout.

## Required fields

1. Upstream repository, immutable commit SHA, and related issue/PR URL.
2. Why the target was selected and what was known before execution.
3. Exact argv command, environment prerequisites, isolation mode, attempt count, and timeout.
4. Receipt ID, integrity checksum, and a reviewed receipt artifact.
5. Observed verdict without reinterpretation. `not_reproduced` and `divergent_failure` are valid results.
6. Limits: hardware, services, caches, permissions, skipped tests, and anything IssueProof did not isolate.
7. Maintainer value: what new information the receipt adds beyond existing CI history.
8. Follow-up status: no action, upstream issue comment, root-cause investigation, or a tested fix/PR.

## Publication rule

Do not open an upstream PR merely to mention IssueProof or add a receipt. A PR needs a repository-owned improvement such as a demonstrated fix, regression test, or maintainer-requested integration. When a receipt only confirms an existing observation, keep it in the case study or add it to an existing issue only if it adds material evidence.
