# Ten external repositories: compatibility matrix and a Go 1.27 signal

Status: **reviewed local evidence; the GJSON finding has not yet been posted upstream**

This matrix applies the published `issueproof@0.3.0` package to selected test commands in ten public repositories. It is a compatibility exercise, not a benchmark or a claim that IssueProof validated every test in each project.

## Method

- Every repository was shallow-cloned and pinned to the immutable commit linked below.
- Dependency installation happened before verification and outside the measured command.
- IssueProof ran each selected command twice with `--expect pass` and `tracked` isolation.
- The process environment was reduced to runtime paths, temporary directories, cache paths, locale, and `CI=1`; no user credentials were exposed to the test commands.
- The host was macOS/Darwin arm64 on Apple M5. Node trials used Node 24.19.0, Python trials used Python 3.13.12, and the initial Go trials used Go 1.27.0.
- All thirteen persisted receipts pass `issueproof check`, and a separate sensitive-string review found no user home path or credential material.

## Matrix

| Repository | Selected command | Immutable commit | Result | Attempt durations | Receipt |
| --- | --- | --- | --- | --- | --- |
| [p-limit](https://github.com/sindresorhus/p-limit) | `npm test` | [`df47604`](https://github.com/sindresorhus/p-limit/commit/df476048d023ff868cd45b35ee47f5fb0ca2b25a) | `verified_pass` | 10.706s / 7.067s | [`87375ec…`](receipts/p-limit.json) |
| [Chalk](https://github.com/chalk/chalk) | `npm test` | [`661317e`](https://github.com/chalk/chalk/commit/661317e6f91fe7c90306c2c48ea9354562ee9146) | `verified_pass` | 9.579s / 6.087s | [`a63e05d…`](receipts/chalk.json) |
| [validator.js](https://github.com/validatorjs/validator.js) | `npm test` | [`a79ff98`](https://github.com/validatorjs/validator.js/commit/a79ff980ab14257e795332989e497bdff3218e87) | `verified_pass` | 14.504s / 8.406s | [`fdcf073…`](receipts/validator-js.json) |
| [Click](https://github.com/pallets/click) | `pytest tests/test_basic.py` | [`36baa15`](https://github.com/pallets/click/commit/36baa15ff831b939a22bc527cd76ce653ef6f66d) | `verified_pass` | 0.375s / 0.250s | [`8ad22c3…`](receipts/click.json) |
| [HTTPX](https://github.com/encode/httpx) | `pytest tests/test_api.py` | [`b5addb6`](https://github.com/encode/httpx/commit/b5addb64f0161ff6bfe94c124ef76f6a1fba5254) | `verified_pass` | 2.863s / 0.766s | [`4ace8f6…`](receipts/httpx.json) |
| [Requests](https://github.com/psf/requests) | `pytest tests/test_requests.py` | [`5460f46`](https://github.com/psf/requests/commit/5460f467b02e49471c0fd6cfc9ca0adab6351f98) | `verified_pass` | 41.713s / 117.485s | [`a9e3bd0…`](receipts/requests.json) |
| [GJSON](https://github.com/tidwall/gjson) | `go test -v .` | [`7d8b382`](https://github.com/tidwall/gjson/commit/7d8b3821e9d2acf35e8a226b63fcf801078e9b96) | `unexpected_failure` | 30.772s / 15.933s | [`7d24959…`](receipts/gjson-go127-full.json) |
| [Testify](https://github.com/stretchr/testify) | `go test ./...` | [`9f9d4f4`](https://github.com/stretchr/testify/commit/9f9d4f4cd868b1667991148401d30a012470b9c9) | `verified_pass` | 51.218s / 0.207s | [`5ba58a7…`](receipts/testify.json) |
| [Cobra](https://github.com/spf13/cobra) | `go test ./...` | [`adbc881`](https://github.com/spf13/cobra/commit/adbc8813901bba65827259daa8e22ff94ec1f30e) | `verified_pass` | 28.229s / 9.762s | [`04ba8eb…`](receipts/cobra.json) |
| [validator](https://github.com/go-playground/validator) | `go test ./...` | [`961375b`](https://github.com/go-playground/validator/commit/961375b9290b3515001e02bfd4556229fe2a197f) | `verified_pass` | 37.754s / 0.236s | [`099a10b…`](receipts/go-validator.json) |

Nine selected commands passed twice. No trial changed tracked repository state. A passing receipt only proves the selected command completed successfully in these two observations; it does not certify the repository or all of its tests.

## GJSON control matrix

The initial Go 1.27 full-package run failed twice in `TestJSONString`, where GJSON compares the exact JSON text produced for a constant string containing invalid UTF-8 bytes. The narrowed test then produced the same failure fingerprint in five of five attempts:

| Runtime/control | Command | Result | Receipt |
| --- | --- | --- | --- |
| Go 1.27.0 | `go test -run '^TestJSONString$' -count=1 -v .` | `stable_failure`, 5/5 | [`939cf13…`](receipts/gjson-go127-specific.json) |
| Go 1.26.2 | `go test -v .` | `verified_pass`, 2/2 | [`e126af3…`](receipts/gjson-go126-full.json) |
| Go 1.27.0 with `GOEXPERIMENT=nojsonv2` | narrowed command above | `verified_pass`, 2/2 | [`fe5bc59…`](receipts/gjson-go127-nojsonv2.json) |

The evidence isolates the observed change to the Go 1.27 JSON implementation boundary. Go 1.27 makes the existing `encoding/json` API use the new v2 backend and documents `GOEXPERIMENT=nojsonv2` as a temporary compatibility control. This does not yet establish whether the appropriate upstream change belongs in GJSON, the test expectation, or Go itself. No upstream issue or PR should be opened until that ownership question is reviewed.

## Limits

- Node repositories did not provide lockfiles at the selected commits, so dependency resolution reflects the registry on the execution date.
- The Python trials intentionally selected one representative test file per repository rather than the entire suite.
- `tracked` isolation was used because installed dependencies live in ignored directories that are not present in clean Git worktrees.
- Module, compiler, and package-manager caches were shared across attempts. Cold/warm cache effects explain several large timing differences; the timings are observations, not performance comparisons.
- The commands ran only on one macOS arm64 host. No conclusion is made about Linux, Windows, other architectures, services, or network-dependent tests.

The accurate launch claim is: **selected commands from ten immutable external repositories were checked twice; nine passed without tracked-state contamination, while one exposed a Go 1.27-specific stable failure with two controls.**
