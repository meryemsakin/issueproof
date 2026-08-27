import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createConfig, findCredentialRisk, loadConfig, validateConfig } from "../src/config.js";

test("creates and loads an argv-based config with paths relative to the config", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "issueproof-config-"));
  try {
    const configPath = path.join(directory, "nested", ".issueproof.json");
    await createConfig(configPath, ["node", "test.js"], { issue: path.join(directory, "issue.md") });
    const loaded = await loadConfig(configPath);
    assert.equal(loaded.command, "node");
    assert.deepEqual(loaded.args, ["test.js"]);
    assert.equal(loaded.cwd, path.join(directory, "nested"));
    assert.equal(loaded.issueFile, path.join(directory, "issue.md"));
    assert.equal(loaded.isolation, "tracked");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts only explicit supported isolation modes", () => {
  assert.deepEqual(validateConfig({ schemaVersion: "1.0", command: ["node", "test.js"], isolation: "worktree" }), []);
  assert.ok(
    validateConfig({ schemaVersion: "1.0", command: ["node", "test.js"], isolation: "container" }).some((error) =>
      error.includes("tracked or worktree"),
    ),
  );
});

test("rejects unknown keys and too few runs", () => {
  const errors = validateConfig({ schemaVersion: "1.0", command: ["npm", "test"], runs: 1, typo: true });
  assert.ok(errors.some((error) => error.includes("Unknown config key")));
  assert.ok(errors.some((error) => error.includes("between 2 and 20")));
});

test("refuses credential-looking command arguments", async () => {
  assert.match(findCredentialRisk(["curl", "--token", "super-secret"]), /credential value/);
  assert.match(findCredentialRisk(["tool", "api_key=super-secret"]), /credential-looking/);
  assert.match(findCredentialRisk(["curl", "-H", "Authorization: Basic dXNlcjpwYXNzd29yZA=="]), /credential-looking/);
  assert.match(findCredentialRisk(["curl", "https://user:password@example.com"]), /credential-looking/);
});
