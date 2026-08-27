import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifyReproduction } from "../src/verify.js";

function git(directory, args) {
  return execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
}

async function createRepository() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "issueproof-isolation-"));
  git(directory, ["init", "--quiet"]);
  await writeFile(path.join(directory, "tracked.txt"), "initial\n");
  await writeFile(
    path.join(directory, "failure.js"),
    [
      "const fs = require('node:fs');",
      "fs.appendFileSync('tracked.txt', 'attempt\\n');",
      "console.error('Error: deterministic isolated mutation');",
      "process.exit(1);",
    ].join("\n"),
  );
  git(directory, ["add", "."]);
  git(directory, [
    "-c",
    "user.name=IssueProof Test",
    "-c",
    "user.email=test@issueproof.invalid",
    "commit",
    "--quiet",
    "-m",
    "fixture",
  ]);
  return directory;
}

test("worktree isolation starts each attempt from committed HEAD", async () => {
  const directory = await createRepository();
  try {
    const receipt = await verifyReproduction({
      command: process.execPath,
      args: ["failure.js"],
      cwd: directory,
      runs: 2,
      timeoutMs: 5_000,
      isolation: "worktree",
    });

    assert.equal(receipt.verdict.name, "stable_failure");
    assert.equal(receipt.git.isolatedAttempts, true);
    assert.equal(receipt.git.attemptsChangedState, 2);
    assert.ok(receipt.runs.every((run) => run.stateChanged && !run.stateContaminated));
    assert.ok(receipt.runs.every((run) => run.isolation.cleanupSucceeded));
    assert.equal(await readFile(path.join(directory, "tracked.txt"), "utf8"), "initial\n");
    assert.equal(git(directory, ["worktree", "list", "--porcelain"]).split("\nworktree ").length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("worktree isolation refuses uncommitted tracked changes", async () => {
  const directory = await createRepository();
  try {
    await writeFile(path.join(directory, "tracked.txt"), "dirty\n");
    await assert.rejects(
      verifyReproduction({
        command: process.execPath,
        args: ["failure.js"],
        cwd: directory,
        runs: 2,
        isolation: "worktree",
      }),
      /Commit or stash/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
