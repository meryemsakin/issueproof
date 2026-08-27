import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repositoryRoot, "bin", "issueproof.js");

function invoke(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });
}

test("init -> config verify --json works end to end", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "issueproof-cli-"));
  try {
    const script = path.join(directory, "failure.js");
    const issue = path.join(directory, "issue.md");
    const config = path.join(directory, ".issueproof.json");
    await writeFile(script, "console.error('Error: deterministic'); process.exit(1);\n");
    await writeFile(
      issue,
      "Observed behavior: Error. Expected behavior: should pass. Steps to reproduce:\n1. Run it. Environment: Node. Always. function parser. Root cause hypothesis.\n",
    );

    const initialized = invoke(["init", "--config", config, "--issue", issue, "--", process.execPath, script], directory);
    assert.equal(initialized.status, 0, initialized.stderr);

    const verified = invoke(["verify", "--config", config, "--json"], directory);
    assert.equal(verified.status, 0, verified.stderr);
    const summary = JSON.parse(verified.stdout);
    assert.equal(summary.verdict, "stable_failure");
    assert.equal(summary.verified, true);
    assert.equal(summary.config, config);
    const receipt = JSON.parse(await readFile(summary.jsonPath, "utf8"));
    assert.equal(receipt.tool.version, "0.3.0");
    const markdown = await readFile(summary.markdownPath, "utf8");
    assert.match(markdown, /not a digital signature or proof of authorship/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
