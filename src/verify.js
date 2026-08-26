import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { classifyRuns } from "./classify.js";
import { collectEnvironment } from "./environment.js";
import { fingerprint } from "./fingerprint.js";
import { collectGitState, gitStateChanged } from "./git.js";
import { sealReceipt } from "./integrity.js";
import { runProcess } from "./process.js";
import { assessIssue } from "./readiness.js";
import { redact } from "./redact.js";
import { VERSION } from "./version.js";

function receiptId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
}

function mergeRedactions(target, matches) {
  for (const match of matches) {
    target.set(match.pattern, (target.get(match.pattern) ?? 0) + match.count);
  }
}

function redactArguments(args, redactionOptions, redactions) {
  const secretFlag = /^--(?:api[-_]?key|access[-_]?token|auth[-_]?token|token|client[-_]?secret|password|passwd|secret)$/i;
  const safe = [];
  let redactNext = false;
  for (const arg of args) {
    if (redactNext) {
      safe.push("<redacted>");
      redactions.set("credential argument", (redactions.get("credential argument") ?? 0) + 1);
      redactNext = false;
      continue;
    }
    const result = redact(arg, redactionOptions);
    mergeRedactions(redactions, result.matches);
    safe.push(result.text);
    redactNext = secretFlag.test(arg);
  }
  return safe;
}

export async function verifyReproduction(options) {
  const {
    command,
    args = [],
    cwd = process.cwd(),
    runs = 3,
    timeoutMs = 60_000,
    maxOutputBytes = 64 * 1024,
    expectation = "fail",
    issueFile,
    showOutput = false,
    onProgress = () => {},
  } = options;
  const absoluteCwd = path.resolve(cwd);
  const redactions = new Map();
  const [environment, initialGit, issueText] = await Promise.all([
    collectEnvironment(absoluteCwd),
    collectGitState(absoluteCwd),
    issueFile ? readFile(path.resolve(issueFile), "utf8") : Promise.resolve(null),
  ]);

  const safeCommand = redact(command, { cwd: absoluteCwd });
  mergeRedactions(redactions, safeCommand.matches);
  const safeArgs = redactArguments(args, { cwd: absoluteCwd }, redactions);

  const attempts = [];
  for (let index = 0; index < runs; index += 1) {
    onProgress({ type: "run-start", attempt: index + 1, total: runs });
    const before = await collectGitState(absoluteCwd);
    const execution = await runProcess(command, args, {
      cwd: absoluteCwd,
      timeoutMs,
      maxOutputBytes,
      onData: showOutput
        ? (chunk, source) => (source === "stdout" ? process.stdout : process.stderr).write(chunk)
        : undefined,
    });
    const after = await collectGitState(absoluteCwd);
    const safeOutput = redact(execution.output.text, { cwd: absoluteCwd });
    mergeRedactions(redactions, safeOutput.matches);
    const failure = fingerprint(execution.exitCode, safeOutput.text);
    const stateChanged = gitStateChanged(before, after);
    const run = {
      attempt: index + 1,
      exitCode: execution.exitCode,
      signal: execution.signal,
      timedOut: execution.timedOut,
      spawnError: execution.spawnError,
      startedAt: execution.startedAt,
      endedAt: execution.endedAt,
      durationMs: execution.durationMs,
      fingerprint: failure.hash,
      signature: failure.signature,
      stateChanged,
      output: {
        text: safeOutput.text,
        totalBytes: execution.output.totalBytes,
        omittedBytes: execution.output.omittedBytes,
      },
    };
    attempts.push(run);
    onProgress({ type: "run-end", run });
    if (stateChanged || execution.timedOut || execution.spawnError) break;
  }

  const finalGit = await collectGitState(absoluteCwd);
  const verdict = classifyRuns(attempts, expectation);
  const issueAssessment = assessIssue(issueText);
  const rawReceipt = {
    schemaVersion: "1.0",
    id: receiptId(),
    createdAt: new Date().toISOString(),
    tool: { name: "issueproof", version: VERSION },
    reproduction: {
      expectation,
      attemptsRequested: runs,
      attemptsCompleted: attempts.length,
      timeoutMs,
      maxOutputBytes,
      command: {
        executable: safeCommand.text,
        args: safeArgs,
      },
    },
    verdict: { name: verdict.verdict, verified: verdict.verified, summary: verdict.summary },
    runs: attempts,
    environment,
    git: initialGit.available
      ? {
          available: true,
          commit: initialGit.commit,
          branch: initialGit.branch,
          initiallyDirty: initialGit.dirty,
          changedPaths: initialGit.changedPaths,
          changedDuringVerification: gitStateChanged(initialGit, finalGit),
        }
      : { available: false },
    issue: issueText
      ? {
          source: path.basename(issueFile),
          sha256: createHash("sha256").update(issueText).digest("hex"),
        }
      : null,
    issueAssessment,
    privacy: {
      persistedEnvironmentValues: false,
      uploadPerformed: false,
      redactionCount: [...redactions.values()].reduce((sum, count) => sum + count, 0),
      redactions: [...redactions].map(([pattern, count]) => ({ pattern, count })),
    },
    limitations: [
      "This is an observation from one machine, not proof of the root cause.",
      "A stable failure signature does not guarantee identical behavior in another environment.",
      "Issue readiness is a deterministic heuristic, not a repair-success prediction.",
    ],
  };
  return sealReceipt(rawReceipt);
}
