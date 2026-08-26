import test from "node:test";
import assert from "node:assert/strict";
import { sealReceipt, validateReceiptShape, verifyReceipt } from "../src/integrity.js";

test("validates an unchanged receipt and rejects a checksum mismatch", () => {
  const receipt = sealReceipt({ schemaVersion: "1.0", verdict: { name: "stable_failure" } });
  assert.equal(verifyReceipt(receipt).valid, true);
  receipt.verdict.name = "verified_pass";
  assert.equal(verifyReceipt(receipt).valid, false);
});

test("rejects a checksummed object that is not a receipt", () => {
  const receipt = sealReceipt({ hello: "world" });
  assert.equal(verifyReceipt(receipt).valid, true);
  assert.ok(validateReceiptShape(receipt).length > 0);
});
