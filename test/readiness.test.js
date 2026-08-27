import test from "node:test";
import assert from "node:assert/strict";
import { assessIssue } from "../src/readiness.js";

test("reports missing evidence rather than inventing it", () => {
  const assessment = assessIssue("The app is broken.");
  assert.equal(assessment.band, "insufficient");
  assert.ok(assessment.checklist.missingRequired.length > 0);
  assert.ok(assessment.checks.some((check) => !check.present && check.suggestion));
});

test("recognizes an evidence-rich report", () => {
  const assessment = assessIssue(`
Observed behavior: Error in parser.js:42.
Expected behavior: it should return a syntax error.
Steps to reproduce:
1. Run npm test.
Environment: Node.js 20 on Linux.
Always reproducible, 3/3 attempts.
Root cause may be in function parseExpression; possible fix is an empty-input guard.
`);
  assert.equal(assessment.score, 100);
  assert.equal(assessment.band, "ready");
  assert.deepEqual(assessment.checklist.missingRequired, []);
  assert.equal(assessment.checklist.requiredPresent, assessment.checklist.requiredTotal);
});
