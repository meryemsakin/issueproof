import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFIG_FILE = ".issueproof.json";

const ALLOWED_KEYS = new Set([
  "$schema",
  "schemaVersion",
  "command",
  "expect",
  "runs",
  "timeoutSeconds",
  "maxOutputKb",
  "issue",
  "output",
  "cwd",
  "isolation",
]);

const SECRET_FLAG = /^--(?:api[-_]?key|access[-_]?token|auth[-_]?token|token|client[-_]?secret|password|passwd|secret)$/i;
const SECRET_ASSIGNMENT = /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|token|client[_-]?secret|password|passwd|secret)\b\s*=/i;
const TOKEN_VALUE = /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b/;
const AUTHORIZATION_VALUE = /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+\S+/i;
const URL_CREDENTIALS = /\bhttps?:\/\/[^\s/:@]+:[^\s/@]+@/i;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;

function integerInRange(value, minimum, maximum) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) return ["Config must be a JSON object."];
  for (const key of Object.keys(config)) {
    if (!ALLOWED_KEYS.has(key)) errors.push(`Unknown config key: ${key}.`);
  }
  if (config.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0.");
  if (!Array.isArray(config.command) || config.command.length === 0) {
    errors.push("command must be a non-empty argv array.");
  } else if (config.command.some((part) => typeof part !== "string" || part.length === 0)) {
    errors.push("Every command entry must be a non-empty string.");
  }
  if (config.expect !== undefined && !["fail", "pass"].includes(config.expect)) {
    errors.push("expect must be fail or pass.");
  }
  if (config.runs !== undefined && !integerInRange(config.runs, 2, 20)) {
    errors.push("runs must be an integer between 2 and 20.");
  }
  if (config.timeoutSeconds !== undefined && !integerInRange(config.timeoutSeconds, 1, 3_600)) {
    errors.push("timeoutSeconds must be an integer between 1 and 3600.");
  }
  if (config.maxOutputKb !== undefined && !integerInRange(config.maxOutputKb, 1, 1_024)) {
    errors.push("maxOutputKb must be an integer between 1 and 1024.");
  }
  if (config.isolation !== undefined && !["tracked", "worktree"].includes(config.isolation)) {
    errors.push("isolation must be tracked or worktree.");
  }
  for (const key of ["issue", "output", "cwd"]) {
    if (config[key] !== undefined && (typeof config[key] !== "string" || config[key].length === 0)) {
      errors.push(`${key} must be a non-empty string.`);
    }
  }
  return errors;
}

export function findCredentialRisk(command) {
  for (let index = 0; index < command.length; index += 1) {
    const part = command[index];
    if (SECRET_FLAG.test(part) && command[index + 1]) return `credential value after ${part}`;
    if (
      SECRET_ASSIGNMENT.test(part) ||
      TOKEN_VALUE.test(part) ||
      AUTHORIZATION_VALUE.test(part) ||
      URL_CREDENTIALS.test(part) ||
      JWT_VALUE.test(part) ||
      /^(?:Bearer|Basic)\s+\S+/i.test(part)
    ) {
      return `credential-looking argument at position ${index + 1}`;
    }
  }
  return null;
}

export function normalizeConfig(config, configPath) {
  const absolutePath = path.resolve(configPath);
  const baseDirectory = path.dirname(absolutePath);
  return {
    source: absolutePath,
    command: config.command[0],
    args: config.command.slice(1),
    expectation: config.expect ?? "fail",
    runs: config.runs ?? 3,
    timeoutMs: (config.timeoutSeconds ?? 60) * 1_000,
    maxOutputBytes: (config.maxOutputKb ?? 64) * 1_024,
    cwd: path.resolve(baseDirectory, config.cwd ?? "."),
    issueFile: config.issue ? path.resolve(baseDirectory, config.issue) : undefined,
    output: path.resolve(baseDirectory, config.output ?? ".issueproof/receipts"),
    isolation: config.isolation ?? "tracked",
  };
}

export async function loadConfig(configPath = DEFAULT_CONFIG_FILE, options = {}) {
  const absolutePath = path.resolve(configPath);
  let text;
  try {
    text = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" && options.optional) return null;
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${absolutePath}: ${error.message}`);
  }
  const errors = validateConfig(parsed);
  if (errors.length > 0) throw new Error(`Invalid config ${absolutePath}:\n- ${errors.join("\n- ")}`);
  const credentialRisk = findCredentialRisk(parsed.command);
  if (credentialRisk) {
    throw new Error(`Refusing config with a ${credentialRisk}. Use environment-based authentication outside argv.`);
  }
  return normalizeConfig(parsed, absolutePath);
}

export async function createConfig(configPath, command, options = {}) {
  const credentialRisk = findCredentialRisk(command);
  if (credentialRisk) {
    throw new Error(`Refusing to persist a ${credentialRisk}. Remove credentials from the command.`);
  }
  const absolutePath = path.resolve(configPath);
  const configDirectory = path.dirname(absolutePath);
  const issue = options.issue
    ? path.relative(configDirectory, path.resolve(options.issue)) || path.basename(options.issue)
    : undefined;
  const config = {
    $schema: "https://raw.githubusercontent.com/meryemsakin/issueproof/main/schemas/config.v1.schema.json",
    schemaVersion: "1.0",
    command,
    expect: options.expectation ?? "fail",
    runs: options.runs ?? 3,
    timeoutSeconds: options.timeoutSeconds ?? 60,
    maxOutputKb: options.maxOutputKb ?? 64,
    ...(issue ? { issue } : {}),
    output: ".issueproof/receipts",
    cwd: ".",
    isolation: options.isolation ?? "tracked",
  };
  const errors = validateConfig(config);
  if (errors.length > 0) throw new Error(errors.join(" "));
  await mkdir(configDirectory, { recursive: true, mode: 0o700 });
  await writeFile(absolutePath, `${JSON.stringify(config, null, 2)}\n`, {
    flag: options.force ? "w" : "wx",
    mode: 0o600,
  });
  return { path: absolutePath, config };
}
