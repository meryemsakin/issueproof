import test from "node:test";
import assert from "node:assert/strict";
import { redact, stripAnsi } from "../src/redact.js";

test("redacts common credentials and local paths", () => {
  const result = redact(
    "API_KEY=super-secret Bearer abcdefghijklmnop /Users/example/work/app token=xyz123456",
    { home: "/Users/example", cwd: "/Users/example/work/app" },
  );
  assert.equal(result.text.includes("super-secret"), false);
  assert.equal(result.text.includes("abcdefghijklmnop"), false);
  assert.equal(result.text.includes("xyz123456"), false);
  assert.match(result.text, /<redacted>/);
  assert.match(result.text, /<repo>/);
});

test("strips ANSI control sequences", () => {
  assert.equal(stripAnsi("\u001b[31merror\u001b[0m"), "error");
});

test("redacts authorization variants, URL credentials, and JWTs", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123456";
  const result = redact(`Basic dXNlcjpwYXNzd29yZA== https://user:password@example.com ${jwt}`, {
    home: "/not-present",
  });
  assert.equal(result.text.includes("dXNlcjpwYXNzd29yZA"), false);
  assert.equal(result.text.includes("user:password"), false);
  assert.equal(result.text.includes(jwt), false);
  assert.match(result.text, /<redacted:jwt>/);
});
