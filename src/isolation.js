import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "./process.js";

async function git(args, cwd, timeoutMs = 15_000) {
  return runProcess("git", args, { cwd, timeoutMs, maxOutputBytes: 32 * 1024 });
}

function gitError(operation, result) {
  const detail = result.output.text.trim() || `exit ${result.exitCode}`;
  return new Error(`Git ${operation} failed: ${detail}`);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function remapRepositoryPath(value, originalRoot, worktreeRoot) {
  if (!path.isAbsolute(value) || !inside(originalRoot, value)) return value;
  return path.join(worktreeRoot, path.relative(originalRoot, value));
}

export async function createWorktreeAttempt({ cwd, command, args, gitState }) {
  if (!gitState.available || !gitState.root || !gitState.commit) {
    throw new Error("Worktree isolation requires a Git repository with a HEAD commit.");
  }
  if (gitState.dirty) {
    throw new Error("Worktree isolation uses committed HEAD and refuses tracked working-tree changes. Commit or stash them first.");
  }
  if (!inside(gitState.root, cwd)) {
    throw new Error("The reproduction cwd must be inside the Git repository for worktree isolation.");
  }

  const container = await mkdtemp(path.join(os.tmpdir(), "issueproof-worktree-"));
  const worktreeRoot = path.join(container, "checkout");
  const added = await git(["worktree", "add", "--detach", "--quiet", worktreeRoot, gitState.commit], gitState.root);
  if (added.exitCode !== 0) {
    await rm(container, { recursive: true, force: true });
    throw gitError("worktree add", added);
  }

  const relativeCwd = path.relative(gitState.root, cwd);
  return {
    cwd: path.join(worktreeRoot, relativeCwd),
    command: remapRepositoryPath(command, gitState.root, worktreeRoot),
    args: args.map((arg) => remapRepositoryPath(arg, gitState.root, worktreeRoot)),
    worktreeRoot,
    async cleanup() {
      const warnings = [];
      const removed = await git(["worktree", "remove", "--force", worktreeRoot], gitState.root);
      if (removed.exitCode !== 0) warnings.push(removed.output.text.trim() || `git worktree remove exited ${removed.exitCode}`);

      let filesystemRemoved = true;
      try {
        await rm(container, { recursive: true, force: true });
      } catch (error) {
        filesystemRemoved = false;
        warnings.push(error.message);
      }

      const pruned = await git(["worktree", "prune"], gitState.root);
      if (pruned.exitCode !== 0) warnings.push(pruned.output.text.trim() || `git worktree prune exited ${pruned.exitCode}`);
      return { ok: removed.exitCode === 0 && filesystemRemoved && pruned.exitCode === 0, warnings };
    },
  };
}
