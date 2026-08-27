# PyTorch #192284: stable Dynamo failure on Python 3.14

Status: **local dogfood evidence; not yet posted upstream**

This case study applies IssueProof to PyTorch's open issue [#192284](https://github.com/pytorch/pytorch/issues/192284), `DISABLED test_jacfwd_different_levels_cpu`. The upstream report described a Dynamo-platform test that had both CI failures and successes. This run asks a narrower question: what happens repeatedly on one current macOS/Python 3.14 environment when every attempt starts from the same committed PyTorch test tree?

## Immutable inputs

- PyTorch test-tree commit: [`a0edfca08d1316d2ce990fc6b892366bb03e1040`](https://github.com/pytorch/pytorch/commit/a0edfca08d1316d2ce990fc6b892366bb03e1040)
- IssueProof commit: [`720973e`](https://github.com/meryemsakin/issueproof/commit/720973e)
- Test: `test/functorch/test_eager_transforms.py TestHessianCPU.test_jacfwd_different_levels_cpu`
- Runtime: Python 3.14.4, PyTorch 2.13.0 wheel, macOS/Darwin arm64, Apple M5
- Verification: 5 attempts, 60-second per-attempt timeout, 16 KiB bounded output, `worktree` isolation

The environment used a temporary Python 3.14 virtual environment with `torch==2.13.0`, `expecttest`, `hypothesis`, `pytest`, and `numpy` installed. The IssueProof invocation was:

```bash
PATH="<python-3.14-venv>/bin:$PATH" node <issueproof-720973e>/bin/issueproof.js verify \
  --no-config \
  --runs 5 \
  --timeout 60 \
  --max-output-kb 16 \
  --isolation worktree \
  --cwd <pytorch-a0edfca> \
  -- /usr/bin/env \
  PYTORCH_TEST_WITH_DYNAMO=1 \
  PYTORCH_TEST_RERUN_DISABLED_TESTS=1 \
  python test/functorch/test_eager_transforms.py \
  TestHessianCPU.test_jacfwd_different_levels_cpu
```

## Controls and result

- Python 3.13 without Dynamo: the selected test passed once.
- Python 3.13 with Dynamo: upstream's version guard skipped the selected test.
- Python 3.14 with Dynamo: the selected test failed in all five isolated attempts.

IssueProof verdict: **`stable_failure`**. All five attempts exited `1` with fingerprint `25eed3cfeb9b61699d3dc6e2431e36e2bf843f17bab8d15d303f3ec8dcdefdd6`. Each temporary worktree was removed successfully and the source checkout remained unchanged.

The stable signal was a `torch._dynamo.exc.TorchRuntimeError` while making a fake-tensor call, ending in an internal assertion around `InferenceMode::is_enabled()` and `_fw_primal` dispatch. The integrity-checked machine-readable artifact is [`receipt.json`](receipt.json); its SHA-256 receipt checksum is `56e1f156536fc4b11c25408652742b91f6ab7822206156de78d71fbd43d48930`.

## What dogfood changed in IssueProof

The first five-attempt run was incorrectly classified as `divergent_failure`. The stack traces were semantically identical, but Python unittest printed a different `Ran 1 test in 0.941s` value on each attempt. IssueProof normalized `seconds` and `ms`, but not the compact `s` unit. The dogfood run produced a narrow normalization fix plus a permanent adversarial regression fixture before the final receipt was generated.

## Limits and upstream decision

This receipt does not prove the PyTorch root cause or reproduce the original CI distribution. The test file came from PyTorch `main`, while execution used the released 2.13.0 wheel rather than a source build from the exact upstream SHA. Global compiler caches and the installed wheel were shared across attempts; Git worktrees isolated only the tracked test checkout. The local environment also lacked PyTorch's full CI-only expected-failure tree.

For those reasons, the receipt is useful IssueProof dogfood but is not yet sufficient for a PyTorch PR. The next upstream-valid step is to reproduce against a matching source/nightly build in an official Linux CI shape, then identify a repository-owned fix and regression test. Only that fix should become a PR. An issue comment is appropriate only if the matching-build run adds evidence that PyTorch maintainers do not already have.
