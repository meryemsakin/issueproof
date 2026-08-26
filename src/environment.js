import os from "node:os";
import { probeVersion } from "./process.js";

const RUNTIMES = [
  ["node", "node", ["--version"]],
  ["npm", "npm", ["--version"]],
  ["pnpm", "pnpm", ["--version"]],
  ["yarn", "yarn", ["--version"]],
  ["bun", "bun", ["--version"]],
  ["python", "python3", ["--version"]],
  ["pip", "pip3", ["--version"]],
  ["go", "go", ["version"]],
  ["rust", "rustc", ["--version"]],
  ["cargo", "cargo", ["--version"]],
  ["java", "java", ["--version"]],
  ["git", "git", ["--version"]],
];

export async function collectEnvironment(cwd) {
  const results = await Promise.all(
    RUNTIMES.map(async ([name, command, args]) => [name, await probeVersion(command, args, { cwd })]),
  );
  return {
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    cpuModel: os.cpus()[0]?.model ?? "unknown",
    ci: Boolean(process.env.CI),
    runtimes: Object.fromEntries(results.filter(([, version]) => version !== null)),
  };
}
