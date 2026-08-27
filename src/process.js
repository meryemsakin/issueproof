import { spawn } from "node:child_process";
import { BoundedCapture } from "./capture.js";

function signalProcessGroup(child, signal) {
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    try {
      return child.kill(signal);
    } catch {
      return false;
    }
  }
}

function forceKillWindowsTree(pid) {
  return new Promise((resolve) => {
    if (!Number.isInteger(pid)) {
      resolve({ ok: false, detail: "The child process has no PID." });
      return;
    }

    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    killer.once("error", (error) => finish({ ok: false, detail: error.message }));
    killer.once("close", (code) => finish({ ok: code === 0, detail: code === 0 ? null : `taskkill exited ${code}` }));
  });
}

export function runProcess(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    timeoutMs = 60_000,
    maxOutputBytes = 64 * 1024,
    onData,
  } = options;

  return new Promise((resolve) => {
    const capture = new BoundedCapture(maxOutputBytes);
    const startedAt = new Date();
    let timedOut = false;
    let spawnError;
    let forceKillTimer;
    let terminationPromise = Promise.resolve({ ok: true, detail: null });

    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const termination = {
      requested: false,
      strategy: process.platform === "win32" ? "windows-process-tree" : "posix-process-group",
      escalated: false,
    };

    const consume = (stream, source) => {
      stream.on("data", (chunk) => {
        capture.append(chunk);
        onData?.(chunk, source);
      });
    };
    consume(child.stdout, "stdout");
    consume(child.stderr, "stderr");

    child.on("error", (error) => {
      spawnError = error;
      capture.append(`issueproof could not start command: ${error.message}\n`);
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      termination.requested = true;
      if (process.platform === "win32") {
        termination.escalated = true;
        terminationPromise = forceKillWindowsTree(child.pid).then((result) => {
          if (!result.ok) termination.error = result.detail;
          return result;
        });
        return;
      }
      signalProcessGroup(child, "SIGTERM");
      forceKillTimer = setTimeout(() => {
        termination.escalated = true;
        signalProcessGroup(child, "SIGKILL");
      }, 2_000);
      forceKillTimer.unref();
    }, timeoutMs);
    timeout.unref();

    child.on("close", async (code, signal) => {
      clearTimeout(timeout);
      if (timedOut && process.platform === "win32") {
        await terminationPromise;
      } else if (timedOut) {
        clearTimeout(forceKillTimer);
        if (signalProcessGroup(child, "SIGKILL")) termination.escalated = true;
      } else {
        clearTimeout(forceKillTimer);
      }
      const endedAt = new Date();
      resolve({
        exitCode: typeof code === "number" ? code : spawnError ? 127 : 1,
        signal: signal ?? null,
        timedOut,
        spawnError: spawnError?.message ?? null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        termination,
        output: capture.value(),
      });
    });
  });
}

export async function probeVersion(command, args = ["--version"], options = {}) {
  const result = await runProcess(command, args, {
    ...options,
    timeoutMs: options.timeoutMs ?? 2_000,
    maxOutputBytes: 4_096,
  });
  if (result.spawnError || result.timedOut || result.exitCode !== 0) return null;
  return result.output.text.trim().split(/\r?\n/)[0]?.slice(0, 240) || null;
}
