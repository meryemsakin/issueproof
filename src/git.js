import { createHash } from "node:crypto";
import { runProcess } from "./process.js";

async function git(args, cwd) {
  return runProcess("git", args, { cwd, timeoutMs: 3_000, maxOutputBytes: 32 * 1024 });
}

function valueOf(result) {
  return result.exitCode === 0 ? result.output.text.trim() : null;
}

export async function collectGitState(cwd) {
  const inside = await git(["rev-parse", "--is-inside-work-tree"], cwd);
  if (valueOf(inside) !== "true") return { available: false };

  const [root, commit, branch, status] = await Promise.all([
    git(["rev-parse", "--show-toplevel"], cwd),
    git(["rev-parse", "HEAD"], cwd),
    git(["branch", "--show-current"], cwd),
    git(["status", "--porcelain=v1", "--untracked-files=no"], cwd),
  ]);
  const rawStatus = valueOf(status) ?? "";
  const changedPaths = rawStatus
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3))
    .sort();
  const head = valueOf(commit);
  const stateMaterial = `${head ?? "unknown"}\n${rawStatus}`;

  return {
    available: true,
    root: valueOf(root),
    commit: head,
    branch: valueOf(branch) || null,
    dirty: changedPaths.length > 0,
    changedPaths,
    fingerprint: createHash("sha256").update(stateMaterial).digest("hex"),
  };
}

export function gitStateChanged(before, after) {
  if (!before.available || !after.available) return false;
  return before.fingerprint !== after.fingerprint;
}
