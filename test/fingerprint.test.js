import test from "node:test";
import assert from "node:assert/strict";
import { fingerprint } from "../src/fingerprint.js";

test("normalizes volatile values without erasing the error signal", () => {
  const first = fingerprint(1, "2026-08-26T10:10:10.123Z Error: failed in 12 ms pid=123");
  const second = fingerprint(1, "2026-08-26T10:10:11.456Z Error: failed in 98 ms pid=999");
  assert.equal(first.hash, second.hash);
  assert.match(first.signature, /Error: failed/);
});

test("keeps distinct errors distinct", () => {
  assert.notEqual(fingerprint(1, "Error: alpha").hash, fingerprint(1, "Error: beta").hash);
});
