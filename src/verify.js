import { randomBytes, createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { classifyRuns } from "./classify.js";
import { collectEnvironment } from "./environment.js";
import { fingerprint } from "./fingerprint.js";
import { collectGitState, gitStateChanged } from "./git.js";
import { sealReceipt } from "./integrity.js";
import { createWorktreeAttempt } from "./isolation.js";
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
    isolation = "tracked",
  } = options;
  const absoluteCwd = await realpath(path.resolve(cwd));
  const redactions = new Map();
  const [collectedEnvironment, initialGit, issueText] = await Promise.all([
    collectEnvironment(absoluteCwd),
    collectGitState(absoluteCwd),
    issueFile ? readFile(path.resolve(issueFile), "utf8") : Promise.resolve(null),
  ]);
  const environment = {
    ...collectedEnvironment,
    runtimes: Object.fromEntries(
      Object.entries(collectedEnvironment.runtimes).map(([name, version]) => {
        const safeVersion = redact(version, { cwd: absoluteCwd });
        mergeRedactions(redactions, safeVersion.matches);
        return [name, safeVersion.text];
      }),
    ),
  };

  const safeCommand = redact(command, { cwd: absoluteCwd });
  mergeRedactions(redactions, safeCommand.matches);
  const safeArgs = redactArguments(args, { cwd: absoluteCwd }, redactions);

  const attempts = [];
  for (let index = 0; index < runs; index += 1) {
    onProgress({ type: "run-start", attempt: index + 1, total: runs });
    const attemptContext = isolation === "worktree"
      ? await createWorktreeAttempt({ cwd: absoluteCwd, command, args, gitState: initialGit })
      : { cwd: absoluteCwd, command, args, cleanup: async () => ({ ok: true, warnings: [] }) };
    let execution;
    let before;
    let after;
    let cleanup = { ok: true, warnings: [] };
    try {
      before = await collectGitState(attemptContext.cwd);
      execution = await runProcess(attemptContext.command, attemptContext.args, {
        cwd: attemptContext.cwd,
        timeoutMs,
        maxOutputBytes,
        onData: showOutput
          ? (chunk, source) => (source === "stdout" ? process.stdout : process.stderr).write(chunk)
          : undefined,
      });
      after = await collectGitState(attemptContext.cwd);
    } finally {
      cleanup = await attemptContext.cleanup();
    }
    const attemptOutput = redact(execution.output.text, { cwd: attemptContext.cwd });
    mergeRedactions(redactions, attemptOutput.matches);
    const safeOutput = redact(attemptOutput.text, { cwd: absoluteCwd });
    mergeRedactions(redactions, safeOutput.matches);
    const failure = fingerprint(execution.exitCode, safeOutput.text);
    const stateChanged = gitStateChanged(before, after);
    const stateContaminated = isolation === "tracked" && stateChanged;
    const run = {
      attempt: index + 1,
      exitCode: execution.exitCode,
      signal: execution.signal,
      timedOut: execution.timedOut,
      spawnError: execution.spawnError,
      startedAt: execution.startedAt,
      endedAt: execution.endedAt,
      durationMs: execution.durationMs,
      termination: execution.termination,
      fingerprint: failure.hash,
      signature: failure.signature,
      stateChanged,
      stateContaminated,
      isolation: {
        mode: isolation,
        cleanStart: isolation === "worktree",
        cleanupSucceeded: cleanup.ok,
        cleanupWarnings: cleanup.warnings,
      },
      isolationCleanupError: cleanup.ok ? null : cleanup.warnings.join("; ") || "Unknown cleanup failure",
      output: {
        text: safeOutput.text,
        totalBytes: execution.output.totalBytes,
        omittedBytes: execution.output.omittedBytes,
      },
    };
    attempts.push(run);
    onProgress({ type: "run-end", run });
    if (stateContaminated || !cleanup.ok || execution.timedOut || execution.spawnError) break;
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
      isolation,
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
          isolationMode: isolation,
          isolatedAttempts: isolation === "worktree",
          changedPaths: initialGit.changedPaths,
          changedDuringVerification: gitStateChanged(initialGit, finalGit),
          attemptsChangedState: attempts.filter((run) => run.stateChanged).length,
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
      "The SHA-256 integrity checksum is not a digital signature or proof of authorship.",
      ...(isolation === "worktree"
        ? ["Worktree isolation resets tracked repository files only; global services, caches, processes, and external systems remain shared."]
        : ["Tracked isolation does not reset untracked or ignored files between attempts."]),
    ],
  };
  return sealReceipt(rawReceipt);
}
