import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function icon(value) {
  return value ? "yes" : "no";
}

function fenced(value) {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [fence + "text", value || "<no output>", fence];
}

export function renderMarkdown(receipt) {
  const lines = [
    "# IssueProof receipt",
    "",
    `- Verdict: **${receipt.verdict.name}**`,
    `- Verified: **${icon(receipt.verdict.verified)}**`,
    `- Summary: ${receipt.verdict.summary}`,
    `- Receipt ID: \`${receipt.id}\``,
    `- Created: ${receipt.createdAt}`,
    "",
    "## Reproduction",
    "",
    `- Expected outcome: ${receipt.reproduction.expectation}`,
    `- Attempts: ${receipt.reproduction.attemptsCompleted}/${receipt.reproduction.attemptsRequested}`,
    `- Isolation: ${receipt.reproduction.isolation ?? "tracked"}`,
    `- Command: \`${[receipt.reproduction.command.executable, ...receipt.reproduction.command.args].map(shellQuote).join(" ")}\``,
    "",
    "| Run | Exit | Duration | Signature | Repo changed | Affects next run |",
    "| ---: | ---: | ---: | --- | --- | --- |",
    ...receipt.runs.map(
      (run) => `| ${run.attempt} | ${run.exitCode} | ${run.durationMs} ms | \`${run.fingerprint.slice(0, 12)}\` | ${icon(run.stateChanged)} | ${icon(run.stateContaminated ?? run.stateChanged)} |`,
    ),
  ];

  if (receipt.issueAssessment) {
    lines.push(
      "",
      "## Issue evidence",
      "",
      `Required checklist: **${receipt.issueAssessment.checklist?.requiredPresent ?? 0}/${receipt.issueAssessment.checklist?.requiredTotal ?? 0} present (${receipt.issueAssessment.band})**`,
      `Optional agent context: **${receipt.issueAssessment.checklist?.optionalPresent ?? 0}/${receipt.issueAssessment.checklist?.optionalTotal ?? 0} present**`,
      "",
      "| Evidence | Required | Present |",
      "| --- | --- | --- |",
      ...receipt.issueAssessment.checks.map(
        (check) => `| ${check.label} | ${icon(check.required)} | ${icon(check.present)} |`,
      ),
      "",
      `Uncalibrated compatibility score: ${receipt.issueAssessment.score}/100`,
    );
    const missing = receipt.issueAssessment.checks.filter((check) => !check.present);
    if (missing.length > 0) {
      lines.push("", "Missing evidence:", "", ...missing.map((check) => `- ${check.suggestion}`));
    }
    lines.push("", `> ${receipt.issueAssessment.note}`);
  }

  lines.push(
    "",
    "## Environment",
    "",
    `- Platform: ${receipt.environment.platform} ${receipt.environment.architecture} (${receipt.environment.osRelease})`,
    `- CI: ${icon(receipt.environment.ci)}`,
    ...Object.entries(receipt.environment.runtimes).map(([name, version]) => `- ${name}: ${version}`),
  );

  if (receipt.git.available) {
    lines.push(
      "",
      "## Git state",
      "",
      `- Commit: \`${receipt.git.commit ?? "unknown"}\``,
      `- Branch: \`${receipt.git.branch ?? "detached"}\``,
      `- Initially dirty: ${icon(receipt.git.initiallyDirty)}`,
      `- Isolation mode: ${receipt.git.isolationMode ?? "tracked"}`,
      `- Attempts that changed tracked state: ${receipt.git.attemptsChangedState ?? 0}`,
      `- State changed while reproducing: ${icon(receipt.git.changedDuringVerification)}`,
    );
  }

  lines.push("", "## Captured output");
  for (const run of receipt.runs) {
    lines.push(
      "",
      `<details><summary>Run ${run.attempt} (${run.output.totalBytes} bytes captured)</summary>`,
      "",
      ...fenced(run.output.text),
      "",
      "</details>",
    );
  }

  lines.push(
    "",
    "## Integrity and privacy",
    "",
    `- Integrity checksum: \`${receipt.integrity.algorithm}:${receipt.integrity.payloadHash}\``,
    "- This checksum detects unrefreshed edits; it is not a digital signature or proof of authorship.",
    `- Redactions applied: ${receipt.privacy.redactionCount}`,
    `- Upload performed: no`,
    "",
    "This receipt proves what IssueProof observed on this machine. It does not prove the root cause or that another environment will behave identically.",
    "",
  );
  return lines.join("\n");
}

export async function writeReport(receipt, outputRoot) {
  const reportDirectory = path.resolve(outputRoot, receipt.id);
  await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(reportDirectory, "receipt.json");
  const markdownPath = path.join(reportDirectory, "receipt.md");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 }),
    writeFile(markdownPath, renderMarkdown(receipt), { mode: 0o600 }),
  ]);
  return { reportDirectory, jsonPath, markdownPath };
}
