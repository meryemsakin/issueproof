import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../src/process.js";

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function waitForExit(pid, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!processExists(pid)) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return !processExists(pid);
}

function forceCleanup(pid) {
  if (!processExists(pid)) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
  } catch {
    // Best-effort cleanup for a process that may have exited between checks.
  }
}

test("does not request termination for a command that exits normally", async () => {
  const result = await runProcess(process.execPath, ["-e", "process.exit(0)"], { timeoutMs: 2_000 });
  assert.equal(result.exitCode, 0);
  assert.equal(result.termination.requested, false);
});

test("terminates descendant processes when a command times out", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "issueproof-process-tree-"));
  const pidFile = path.join(directory, "descendant.pid");
  let descendantPid;
  try {
    const parentScript = [
      "const { spawn } = require('node:child_process');",
      "const fs = require('node:fs');",
      "const child = spawn(process.execPath, ['-e', 'process.on(\\'SIGTERM\\', () => {}); setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
      "fs.writeFileSync(process.argv[1], String(child.pid));",
      "setInterval(() => {}, 1000);",
    ].join("\n");

    const result = await runProcess(process.execPath, ["-e", parentScript, pidFile], {
      timeoutMs: 500,
      maxOutputBytes: 4_096,
    });
    descendantPid = Number.parseInt(await readFile(pidFile, "utf8"), 10);

    assert.equal(result.timedOut, true);
    assert.equal(result.termination.requested, true);
    assert.match(result.termination.strategy, /process-(?:group|tree)/);
    assert.equal(await waitForExit(descendantPid), true, `descendant process ${descendantPid} survived timeout`);
  } finally {
    if (Number.isInteger(descendantPid)) forceCleanup(descendantPid);
    await rm(directory, { recursive: true, force: true });
  }
});
