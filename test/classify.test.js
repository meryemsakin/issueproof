import test from "node:test";
import assert from "node:assert/strict";
import { classifyRuns } from "../src/classify.js";

const run = (exitCode, fingerprint, extra = {}) => ({
  exitCode,
  fingerprint,
  timedOut: false,
  stateChanged: false,
  ...extra,
});

test("verifies a stable repeated failure", () => {
  const result = classifyRuns([run(1, "same"), run(1, "same"), run(1, "same")]);
  assert.equal(result.verdict, "stable_failure");
  assert.equal(result.verified, true);
});

test("does not call divergent failures stable", () => {
  const result = classifyRuns([run(1, "a"), run(1, "b"), run(1, "c")]);
  assert.equal(result.verdict, "divergent_failure");
  assert.equal(result.verified, false);
});

test("detects flaky outcomes", () => {
  const result = classifyRuns([run(1, "a"), run(0, "b")]);
  assert.equal(result.verdict, "flaky");
});

test("rejects a run that changes tracked repository state", () => {
  const result = classifyRuns([run(1, "a", { stateChanged: true })]);
  assert.equal(result.verdict, "contaminated");
});

test("does not claim stability from a single observation", () => {
  const result = classifyRuns([run(1, "a")]);
  assert.equal(result.verdict, "observed_failure");
  assert.equal(result.verified, false);
});

test("reports a command that cannot be started", () => {
  const result = classifyRuns([run(127, "a", { spawnError: "ENOENT" })]);
  assert.equal(result.verdict, "command_error");
  assert.equal(result.verified, false);
});
