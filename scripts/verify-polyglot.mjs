import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repositoryRoot, "bin", "issueproof.js");
const examples = path.join(repositoryRoot, "examples", "polyglot");
const python = process.env.ISSUEPROOF_PYTHON || (process.platform === "win32" ? "python" : "python3");

const cases = [
  { name: "Node.js", command: process.execPath, args: [path.join(examples, "stable-failure.js")] },
  { name: "Python", command: python, args: [path.join(examples, "stable_failure.py")] },
  { name: "Go", command: "go", args: ["run", path.join(examples, "stable_failure.go")] },
];

for (const example of cases) {
  const output = mkdtempSync(path.join(os.tmpdir(), `issueproof-${example.name.toLowerCase()}-`));
  try {
    const result = spawnSync(
      process.execPath,
      [
        cli,
        "verify",
        "--json",
        "--no-config",
        "--runs",
        "2",
        "--output",
        output,
        "--",
        example.command,
        ...example.args,
      ],
      { cwd: repositoryRoot, encoding: "utf8" },
    );

    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${example.name}\n${result.stderr}\n${result.stdout}`);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.verdict, "stable_failure");
    assert.equal(summary.verified, true);

    const receipt = JSON.parse(readFileSync(summary.jsonPath, "utf8"));
    assert.equal(receipt.runs.length, 2);
    assert.equal(new Set(receipt.runs.map((run) => run.fingerprint)).size, 1);
    console.log(`verified ${example.name}: ${summary.verdict}`);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}
