import { spawn } from "node:child_process";
import { BoundedCapture } from "./capture.js";

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

    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

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
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
      forceKillTimer.unref();
    }, timeoutMs);
    timeout.unref();

    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      clearTimeout(forceKillTimer);
      const endedAt = new Date();
      resolve({
        exitCode: typeof code === "number" ? code : spawnError ? 127 : 1,
        signal: signal ?? null,
        timedOut,
        spawnError: spawnError?.message ?? null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
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
