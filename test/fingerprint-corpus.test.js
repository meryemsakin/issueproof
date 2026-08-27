import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fingerprint } from "../src/fingerprint.js";

const corpusPath = fileURLToPath(new URL("fixtures/fingerprint-corpus.json", import.meta.url));
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));

for (const fixture of corpus.equivalent) {
  test(`fingerprint equivalence: ${fixture.name}`, () => {
    const hashes = new Set(fixture.samples.map((sample) => fingerprint(fixture.exitCode, sample).hash));
    assert.equal(hashes.size, 1);
  });
}

for (const fixture of corpus.distinct) {
  test(`fingerprint separation: ${fixture.name}`, () => {
    const left = fingerprint(fixture.left.exitCode, fixture.left.output);
    const right = fingerprint(fixture.right.exitCode, fixture.right.output);
    assert.notEqual(left.hash, right.hash);
  });
}
