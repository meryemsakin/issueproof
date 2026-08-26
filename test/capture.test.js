import test from "node:test";
import assert from "node:assert/strict";
import { BoundedCapture } from "../src/capture.js";

test("keeps the head and tail when output exceeds the limit", () => {
  const capture = new BoundedCapture(10);
  capture.append("abcdefghij");
  capture.append("klmnopqrst");
  const value = capture.value();
  assert.equal(value.totalBytes, 20);
  assert.equal(value.omittedBytes, 10);
  assert.match(value.text, /^abcde/);
  assert.match(value.text, /pqrst$/);
});

test("returns complete output under the limit", () => {
  const capture = new BoundedCapture(20);
  capture.append("hello");
  assert.deepEqual(capture.value(), { text: "hello", totalBytes: 5, omittedBytes: 0 });
});
