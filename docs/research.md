# Landscape research and product decision

Research date: **26 August 2026**

## Executive conclusion

The original idea—run a failing command and package logs, environment, Git metadata, redaction, Markdown, and JSON—is useful but no longer differentiated. [FailPack](https://failpack.dev/docs) already offers command capture, local reports, redaction, environment/Git context, AI prompts, bundles, cloud sync, and agent modes. The newly published [repropack-cli](https://socket.dev/npm/package/repropack-cli) covers an even closer local-only command-to-redacted-report flow. “BugBox” is also an active [visual/voice feedback product](https://www.bugbox.ai/), making that name unsuitable.

IssueProof therefore begins one step later: it verifies whether an exact reproduction is stable, detects contaminated or divergent attempts, and emits an evidence receipt that a human or repair agent can trust and independently inspect.

## GitHub and developer-tool landscape

| Project | What it does well | Boundary relative to IssueProof |
| --- | --- | --- |
| [ReproZip](https://docs.reprozip.org/en/latest/) | Traces system calls and packages binaries, files, and dependencies for scientific reproducibility | Much heavier; packing is Linux-oriented and targets full computational environments |
| [sosreport](https://github.com/sosreport/sos) | Plugin-based system diagnostic collection and obfuscation | System/support diagnostics, primarily Linux/Unix; does not verify a developer reproduction contract |
| [Apport](https://github.com/canonical/apport) | Crash interception and OS/package context collection | Ubuntu crash workflow rather than a cross-project repeated reproduction verifier |
| [Replicated Troubleshoot](https://github.com/replicatedhq/troubleshoot) | Kubernetes collectors, analyzers, redactors, and support bundles | Cluster/vendor-support domain rather than local code/test failure proof |
| [bugreport (Rust)](https://github.com/sharkdp/bugreport) | Lets application authors collect OS, command, environment, and command output into Markdown | A library embedded by tool authors; not a universal verifier |
| [envinfo](https://github.com/tabrindle/envinfo) | Concise environment collection for JavaScript issue reports | Collects context but does not execute or compare failure attempts |
| [act](https://github.com/nektos/act) | Runs GitHub Actions locally | CI-specific execution, not issue-evidence verification |
| [ActionsRemaker](https://web.cs.ucdavis.edu/~rubio/includes/icse23-demo.pdf) | Reproduces GitHub Actions jobs in Docker | CI workflow reproduction, not a small general-purpose CLI receipt |
| [reports-check-action](https://github.com/marketplace/actions/reports-check-action) | Checks incoming issue text for quality problems | Text assessment without executable observation proof |
| [GitHub spec-kit bug workflow](https://github.com/github/spec-kit/blob/main/.github/workflows/bug-test.md) | Runs issue-derived tests in an isolated runner and produces a complete test report | A repository workflow; it supports the need for evidence but is not a portable local contract |

Security guidance in support-bundle implementations repeatedly favors bounded collection, redaction at the collection/model boundary, partial results rather than all-or-nothing failure, local inspection before sharing, and a separate explicit upload action. These defaults influenced the MVP. See the [Mooncake support-bundle RFC](https://github.com/kvcache-ai/Mooncake/issues/2864) and [Validibot support-bundle guide](https://github.com/mcquilleninteractive/validibot/blob/main/docs/operations/self-hosting/support-bundle.md).

## Kaggle datasets

- [GitBugs](https://www.kaggle.com/datasets/av9ash/gitbugs) contains more than 150,000 standardized reports from nine open-source projects and provides duplicate mappings and splits. It is useful later for duplicate retrieval and readiness-check evaluation, not for training a generative MVP.
- [Python Tracebacks](https://www.kaggle.com/datasets/simiotic/python-tracebacks) extracts stack traces from 2,071,515 popular-project issues. It is a useful test source for stack-trace parsing and de-identification/redaction.
- The recent [50k Bug Dataset](https://www.kaggle.com/datasets/mirzayasirabdullah07/50k-bug-dataset) has attractive structured fields but unclear provenance from its public description; it should not be a core training or evaluation source until provenance and leakage are audited.

Decision: no model training in v0.1. These datasets should support measured optional features later, not justify an “AI-powered” label now.

## Hugging Face datasets

- [SWE-bench](https://huggingface.co/datasets/SWE-bench/SWE-bench) has 2,294 real issue–pull-request tasks across 12 Python repositories.
- [SWE-bench Verified](https://huggingface.co/datasets/SWE-bench/SWE-bench_Verified) provides a human-validated 500-task subset; [SWE-bench Live](https://huggingface.co/datasets/SWE-bench-Live/SWE-bench-Live) reduces staleness with newer issues.
- [SWEbenchCodeRetrieval](https://huggingface.co/datasets/mteb/SWEbenchCodeRetrieval) maps issue descriptions to relevant source files and is appropriate for evaluating a future localization adapter.
- Synthetic datasets such as [VisionTriage Multimodal](https://huggingface.co/datasets/tathadn/visiontriage-multimodal) can exercise schemas and UI prototypes, but should not substitute for real-world validation.

Decision: evaluate whether receipts improve agent resolution and file retrieval through controlled ablations; do not claim usefulness from dataset size alone.

## Research papers

Human-oriented studies consistently find that reproduction steps, environment, observed behavior, stack traces, and exact failure evidence matter:

- [The significance of bug report elements](https://link.springer.com/article/10.1007/s10664-020-09882-z) found strong project-level associations between elements such as stack traces/reproduction material and resolution time.
- [What Makes a Good Bug Report?](https://www.st.cs.uni-saarland.de/publications/details/bettenburg-tr-2007/) reports that developers actively seek steps to reproduce and stack traces, while inaccurate/incomplete steps are a major obstacle.
- [Detecting Missing Information in Bug Descriptions](https://ojcchar.github.io/files/8-fse17.pdf) targets missing expected behavior and reproduction steps.
- [Assessing the Quality of the Steps to Reproduce](https://arxiv.org/abs/1906.07107) demonstrates automated feedback on reproduction-step quality.
- [An Empirical Investigation into the Reproduction of Bug Reports for Android Apps](https://arxiv.org/abs/2301.01235) centers environment, steps to reproduce, and observed behavior.
- [Why are Some Bugs Non-Reproducible?](https://arxiv.org/abs/2108.05316) analyzes 576 non-reproducible reports and identifies multiple failure factors.
- The [GitBugs paper](https://arxiv.org/abs/2504.09651) describes the standardized dataset used above.

A particularly important 2026 result changes the AI-facing design. [Writing Bug Reports for Software Repair Agents: What Information Matters Most?](https://arxiv.org/abs/2607.09553) studies 441 SWE-bench Verified bug reports across three model backbones. It reports positive associations for localization cues and suggested repair directions; its ablation suggests agents benefit less from traditional reproduction prose than humans do. This does **not** make reproduction unnecessary: it means a report intended for both audiences needs two explicit layers—verified execution evidence for humans and search-narrowing/localization evidence for agents.

## Medium practitioner signals

Medium is treated as practitioner input, not primary evidence.

- [Writing a useful bug report](https://medium.com/@john.daniels/writing-a-useful-bug-report-c63a01164b2e) emphasizes environment, minimal reproduction steps, and detailed error information.
- [From Chat Messages to Jira Bugs](https://medium.com/@alirezaaedalat/from-chat-messages-to-jira-bugs-building-a-production-ready-ai-powered-qa-intake-workflow-4aede62f4769) illustrates the operational cost of turning noisy messages into structured, traceable bug intake.
- [Debugging Under Supervised Coding Principles](https://medium.com/software-engineering-for-the-real-world/debugging-under-supervised-coding-principles-0311785a58fb) argues that AI hypotheses should begin from reports, reproduction steps, logs, and relevant code and remain subject to human validation.
- [My AI Agent “Fixed” the Same Bug Six Times](https://medium.com/kairi-ai/my-ai-agent-fixed-the-same-bug-six-times-lessons-from-auto-triaging-datadog-errors-24e18f7b68e3) is a useful caution: merged output is not proof of a durable fix, and recurrence should be measured.

## Product thesis

The strongest open-source wedge is not another report formatter. It is a small, local, deterministic gate between “someone says this is a bug” and “a human or agent should spend time fixing it.”

The MVP succeeds if it can truthfully say one of the following:

- this failure repeated with the same signature;
- it is intermittent;
- it failed differently each time;
- it did not reproduce here;
- the attempted proof mutated its own starting state;
- the accompanying issue still lacks named evidence.

That output is useful without an LLM, testable in CI, and forms a safe substrate for later retrieval or analysis.
