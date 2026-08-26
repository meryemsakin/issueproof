import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("publishes an executable IssueProof CLI entry", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(packageJson.bin.issueproof, "bin/issueproof.js");

  const executable = path.join(repositoryRoot, packageJson.bin.issueproof);
  await access(executable, constants.X_OK);
  const source = await readFile(executable, "utf8");
  assert.match(source, /^#!\/usr\/bin\/env node\r?\n/);
});
