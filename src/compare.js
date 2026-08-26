import { validateReceiptShape, verifyReceipt } from "./integrity.js";

const FAILURE_VERDICTS = new Set([
  "stable_failure",
  "divergent_failure",
  "flaky",
  "observed_failure",
  "unexpected_failure",
]);
const ABSENT_VERDICTS = new Set(["not_reproduced", "verified_pass"]);

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function signatures(receipt) {
  return [...new Set(receipt.runs.filter((run) => run.exitCode !== 0).map((run) => run.fingerprint))].sort();
}

function environmentDifferences(left, right) {
  const differences = [];
  for (const key of ["platform", "architecture", "osRelease"]) {
    if (left.environment[key] !== right.environment[key]) {
      differences.push({ field: key, left: left.environment[key] ?? null, right: right.environment[key] ?? null });
    }
  }
  const runtimeNames = new Set([
    ...Object.keys(left.environment.runtimes ?? {}),
    ...Object.keys(right.environment.runtimes ?? {}),
  ]);
  for (const name of [...runtimeNames].sort()) {
    const leftVersion = left.environment.runtimes?.[name] ?? null;
    const rightVersion = right.environment.runtimes?.[name] ?? null;
    if (leftVersion !== rightVersion) {
      differences.push({ field: `runtime.${name}`, left: leftVersion, right: rightVersion });
    }
  }
  return differences;
}

function validateForComparison(receipt, label) {
  const errors = validateReceiptShape(receipt);
  if (errors.length > 0) throw new Error(`${label} receipt has an invalid schema: ${errors.join(" ")}`);
  const integrity = verifyReceipt(receipt);
  if (!integrity.valid) throw new Error(`${label} receipt failed integrity verification: ${integrity.reason}`);
}

export function compareReceipts(left, right) {
  validateForComparison(left, "Left");
  validateForComparison(right, "Right");

  const sameCommand = sameJson(left.reproduction.command, right.reproduction.command);
  const commandRedacted = [left, right].some(
    (receipt) => JSON.stringify(receipt.reproduction.command).includes("<redacted>"),
  );
  const leftSignatures = signatures(left);
  const rightSignatures = signatures(right);
  const sharedSignatures = leftSignatures.filter((signature) => rightSignatures.includes(signature));
  const leftFailure = FAILURE_VERDICTS.has(left.verdict.name);
  const rightFailure = FAILURE_VERDICTS.has(right.verdict.name);
  const leftAbsent = ABSENT_VERDICTS.has(left.verdict.name);
  const rightAbsent = ABSENT_VERDICTS.has(right.verdict.name);

  let status;
  if (!sameCommand || commandRedacted) status = "incomparable_command";
  else if (leftFailure && rightAbsent) status = "failure_absent";
  else if (leftAbsent && rightFailure) status = "failure_appeared";
  else if (leftFailure && rightFailure && sharedSignatures.length > 0) status = "same_failure";
  else if (leftFailure && rightFailure) status = "changed_failure";
  else if (left.verdict.name === right.verdict.name) status = "same_outcome";
  else status = "changed_outcome";

  return {
    status,
    comparable: sameCommand && !commandRedacted,
    command: { same: sameCommand, redacted: commandRedacted },
    verdict: {
      left: left.verdict.name,
      right: right.verdict.name,
      transition: `${left.verdict.name} -> ${right.verdict.name}`,
    },
    failureSignatures: { left: leftSignatures, right: rightSignatures, shared: sharedSignatures },
    git: {
      sameCommit: Boolean(left.git?.commit && left.git.commit === right.git?.commit),
      leftCommit: left.git?.commit ?? null,
      rightCommit: right.git?.commit ?? null,
    },
    issue: {
      same: Boolean(left.issue?.sha256 && left.issue.sha256 === right.issue?.sha256),
      leftSha256: left.issue?.sha256 ?? null,
      rightSha256: right.issue?.sha256 ?? null,
    },
    environmentDifferences: environmentDifferences(left, right),
    receipts: {
      left: { id: left.id, createdAt: left.createdAt },
      right: { id: right.id, createdAt: right.createdAt },
    },
    note:
      status === "failure_absent"
        ? "The earlier failure was not observed in the later receipt; this is evidence of absence for this command, not proof of root-cause resolution."
        : "Comparison is based on sealed receipt observations, not a root-cause inference.",
  };
}

export function renderComparison(result) {
  const lines = [
    `Status: ${result.status}`,
    `Comparable command: ${result.comparable ? "yes" : "no"}`,
    `Verdict: ${result.verdict.transition}`,
    `Shared failure signatures: ${result.failureSignatures.shared.length}`,
    `Same Git commit: ${result.git.sameCommit ? "yes" : "no"}`,
    `Same issue text: ${result.issue.same ? "yes" : "no"}`,
    `Environment differences: ${result.environmentDifferences.length}`,
  ];
  for (const difference of result.environmentDifferences) {
    lines.push(`- ${difference.field}: ${difference.left ?? "<missing>"} -> ${difference.right ?? "<missing>"}`);
  }
  lines.push(result.note);
  return lines.join("\n");
}
