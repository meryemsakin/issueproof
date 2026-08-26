import test from "node:test";
import assert from "node:assert/strict";
import { compareReceipts } from "../src/compare.js";
import { sealReceipt } from "../src/integrity.js";

function receipt(options = {}) {
  const verdict = options.verdict ?? "stable_failure";
  const exitCode = options.exitCode ?? (verdict === "not_reproduced" || verdict === "verified_pass" ? 0 : 1);
  return sealReceipt({
    schemaVersion: "1.0",
    id: options.id ?? `receipt-${Math.random()}`,
    createdAt: "2026-08-26T00:00:00.000Z",
    tool: { name: "issueproof", version: "0.2.0" },
    reproduction: {
      expectation: "fail",
      attemptsRequested: 2,
      attemptsCompleted: 2,
      command: options.command ?? { executable: "npm", args: ["test"] },
    },
    verdict: { name: verdict, verified: Boolean(options.verified), summary: verdict },
    runs: [
      { attempt: 1, exitCode, durationMs: 10, fingerprint: options.fingerprint ?? "failure-a", stateChanged: false, output: {} },
      { attempt: 2, exitCode, durationMs: 11, fingerprint: options.fingerprint ?? "failure-a", stateChanged: false, output: {} },
    ],
    environment: {
      platform: options.platform ?? "linux",
      architecture: "x64",
      osRelease: "1",
      runtimes: { node: options.node ?? "v24.0.0" },
    },
    git: { available: true, commit: options.commit ?? "abc" },
    issue: { sha256: "issue-a" },
    privacy: {},
  });
}

test("recognizes the same failure across integrity-checked receipts", () => {
  const result = compareReceipts(receipt(), receipt({ commit: "def" }));
  assert.equal(result.status, "same_failure");
  assert.equal(result.failureSignatures.shared.length, 1);
  assert.equal(result.git.sameCommit, false);
});

test("reports when an earlier failure is absent", () => {
  const result = compareReceipts(receipt(), receipt({ verdict: "not_reproduced", exitCode: 0 }));
  assert.equal(result.status, "failure_absent");
  assert.match(result.note, /not proof of root-cause resolution/);
});

test("refuses to compare commands containing redacted arguments", () => {
  const result = compareReceipts(
    receipt({ command: { executable: "tool", args: ["--token", "<redacted>"] } }),
    receipt({ command: { executable: "tool", args: ["--token", "<redacted>"] } }),
  );
  assert.equal(result.status, "incomparable_command");
  assert.equal(result.comparable, false);
});

test("rejects tampered input receipts", () => {
  const left = receipt();
  left.verdict.name = "verified_pass";
  assert.throws(() => compareReceipts(left, receipt()), /integrity verification/);
});
