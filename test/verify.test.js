import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyReproduction } from "../src/verify.js";

test("produces an integrity-checked stable receipt and redacts a separate credential argument", async () => {
  const secret = "do-not-persist-this-token";
  const receipt = await verifyReproduction({
    command: process.execPath,
    args: ["-e", "console.error('Error: stable'); process.exit(1)", "--", "--token", secret],
    runs: 2,
    timeoutMs: 5_000,
  });
  assert.equal(receipt.verdict.name, "stable_failure");
  assert.equal(JSON.stringify(receipt).includes(secret), false);
  assert.ok(receipt.privacy.redactions.some((entry) => entry.pattern === "credential argument"));
});

test("stops when a reproduction mutates tracked Git state", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "issueproof-test-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    await writeFile(path.join(directory, "tracked.txt"), "initial\n");
    execFileSync("git", ["add", "tracked.txt"], { cwd: directory });
    execFileSync(
      "git",
      ["-c", "user.name=IssueProof Test", "-c", "user.email=test@issueproof.invalid", "commit", "--quiet", "-m", "initial"],
      { cwd: directory },
    );

    const receipt = await verifyReproduction({
      command: process.execPath,
      args: [
        "-e",
        "require('node:fs').appendFileSync('tracked.txt', 'changed\\n'); console.error('Error: mutation'); process.exit(1)",
      ],
      cwd: directory,
      runs: 3,
      timeoutMs: 5_000,
    });
    assert.equal(receipt.verdict.name, "contaminated");
    assert.equal(receipt.runs.length, 1);
    assert.equal(receipt.runs[0].stateChanged, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
