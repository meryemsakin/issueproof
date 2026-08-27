import { readFile } from "node:fs/promises";
import path from "node:path";
import { compareReceipts, renderComparison } from "./compare.js";
import { createConfig, DEFAULT_CONFIG_FILE, loadConfig } from "./config.js";
import { validateReceiptShape, verifyReceipt } from "./integrity.js";
import { assessIssue } from "./readiness.js";
import { writeReport } from "./report.js";
import { verifyReproduction } from "./verify.js";
import { VERSION } from "./version.js";

const HELP = `IssueProof — verify that a bug reproduction is stable

Usage:
  issueproof init [options] -- <command> [args...]
  issueproof verify [options] [-- <command> [args...]]
  issueproof compare [--json] <left.json> <right.json>
  issueproof assess <issue.md>
  issueproof check <receipt.json>

Verify options:
  --config <file>        Config file (default: .issueproof.json)
  --no-config            Ignore the default config file
  --runs <n>             Attempts to execute (default: 3, min: 2, max: 20)
  --timeout <seconds>    Per-attempt timeout (default: 60)
  --expect <fail|pass>   Expected command outcome (default: fail)
  --issue <file>         Assess an issue description alongside runtime proof
  --output <directory>   Receipt root (default: .issueproof/receipts)
  --cwd <directory>      Working directory for the command
  --isolation <mode>     tracked or worktree (default: tracked)
  --max-output-kb <n>    Stored head+tail output limit (default: 64)
  --show-output          Stream raw command output while running
  --json                 Emit a machine-readable summary on stdout

Init options:
  --config <file>        Config path (default: .issueproof.json)
  --issue <file>         Store an issue-description path
  --expect <fail|pass>   Expected outcome (default: fail)
  --runs <n>             Attempts (default: 3)
  --isolation <mode>     tracked or worktree (default: tracked)
  --force                Replace an existing config file

Examples:
  issueproof init -- npm test
  issueproof verify
  issueproof verify --runs 5 --issue issue.md -- npm test
  issueproof compare before/receipt.json after/receipt.json
`;

const DEFAULTS = {
  runs: 3,
  timeoutMs: 60_000,
  expectation: "fail",
  output: path.resolve(".issueproof/receipts"),
  cwd: process.cwd(),
  maxOutputBytes: 64 * 1024,
  showOutput: false,
  isolation: "tracked",
};

function parseInteger(value, name, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function takeValue(tokens, index, name) {
  const value = tokens[index + 1];
  if (!value || value === "--") throw new Error(`${name} requires a value.`);
  return value;
}

function splitCommand(tokens) {
  const separator = tokens.indexOf("--");
  if (separator === -1) return { optionTokens: tokens, commandTokens: [] };
  return { optionTokens: tokens.slice(0, separator), commandTokens: tokens.slice(separator + 1) };
}

function parseVerify(tokens) {
  const { optionTokens, commandTokens } = splitCommand(tokens);
  const parsed = {
    overrides: {},
    configPath: DEFAULT_CONFIG_FILE,
    configExplicit: false,
    useConfig: true,
    json: false,
    help: false,
    commandTokens,
  };
  for (let index = 0; index < optionTokens.length; index += 1) {
    const token = optionTokens[index];
    if (token === "--config") {
      parsed.configPath = takeValue(optionTokens, index, token);
      parsed.configExplicit = true;
      index += 1;
    } else if (token === "--no-config") {
      parsed.useConfig = false;
    } else if (token === "--runs") {
      parsed.overrides.runs = parseInteger(takeValue(optionTokens, index, token), token, 2, 20);
      index += 1;
    } else if (token === "--timeout") {
      parsed.overrides.timeoutMs = parseInteger(takeValue(optionTokens, index, token), token, 1, 3_600) * 1_000;
      index += 1;
    } else if (token === "--expect") {
      parsed.overrides.expectation = takeValue(optionTokens, index, token);
      if (!["fail", "pass"].includes(parsed.overrides.expectation)) throw new Error("--expect must be fail or pass.");
      index += 1;
    } else if (token === "--issue") {
      parsed.overrides.issueFile = path.resolve(takeValue(optionTokens, index, token));
      index += 1;
    } else if (token === "--output") {
      parsed.overrides.output = path.resolve(takeValue(optionTokens, index, token));
      index += 1;
    } else if (token === "--cwd") {
      parsed.overrides.cwd = path.resolve(takeValue(optionTokens, index, token));
      index += 1;
    } else if (token === "--isolation") {
      parsed.overrides.isolation = takeValue(optionTokens, index, token);
      if (!["tracked", "worktree"].includes(parsed.overrides.isolation)) {
        throw new Error("--isolation must be tracked or worktree.");
      }
      index += 1;
    } else if (token === "--max-output-kb") {
      parsed.overrides.maxOutputBytes = parseInteger(takeValue(optionTokens, index, token), token, 1, 1_024) * 1_024;
      index += 1;
    } else if (token === "--show-output") {
      parsed.overrides.showOutput = true;
    } else if (token === "--json") {
      parsed.json = true;
    } else if (["-h", "--help"].includes(token)) {
      parsed.help = true;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  if (!parsed.useConfig && parsed.configExplicit) throw new Error("--config and --no-config cannot be used together.");
  return parsed;
}

async function resolveVerifyOptions(parsed) {
  let config = null;
  if (parsed.useConfig) config = await loadConfig(parsed.configPath, { optional: !parsed.configExplicit });
  const explicitCommand = parsed.commandTokens.length > 0 ? parsed.commandTokens : null;
  if (!explicitCommand && !config) {
    throw new Error(`No command supplied and no ${parsed.configPath} config was found.`);
  }
  const commandTokens = explicitCommand ?? [config.command, ...config.args];
  return {
    ...DEFAULTS,
    ...(config ?? {}),
    ...parsed.overrides,
    command: commandTokens[0],
    args: commandTokens.slice(1),
    configSource: config?.source ?? null,
  };
}

async function runVerify(tokens) {
  const parsed = parseVerify(tokens);
  if (parsed.help) {
    console.log(HELP);
    return 0;
  }
  const options = await resolveVerifyOptions(parsed);
  const receipt = await verifyReproduction({
    ...options,
    onProgress(event) {
      if (event.type === "run-start") {
        process.stderr.write(`issueproof: run ${event.attempt}/${event.total}... `);
      } else {
        const suffix = event.run.stateChanged ? ", repository changed" : "";
        process.stderr.write(`exit ${event.run.exitCode}, ${event.run.durationMs} ms${suffix}\n`);
      }
    },
  });
  const paths = await writeReport(receipt, options.output);
  const summary = {
    verdict: receipt.verdict.name,
    verified: receipt.verdict.verified,
    summary: receipt.verdict.summary,
    receiptId: receipt.id,
    config: options.configSource,
    markdownPath: paths.markdownPath,
    jsonPath: paths.jsonPath,
    integrity: receipt.integrity,
  };
  if (parsed.json) {
    console.log(JSON.stringify(summary));
  } else {
    console.log(`${receipt.verdict.name}: ${receipt.verdict.summary}`);
    if (options.configSource) console.log(`Config: ${options.configSource}`);
    console.log(`Receipt: ${paths.markdownPath}`);
    console.log(`Machine-readable: ${paths.jsonPath}`);
  }
  return receipt.verdict.verified ? 0 : 1;
}

function parseInit(tokens) {
  const { optionTokens, commandTokens } = splitCommand(tokens);
  if (commandTokens.length === 0) throw new Error("Usage: issueproof init [options] -- <command> [args...]");
  const parsed = { configPath: DEFAULT_CONFIG_FILE, commandTokens, force: false };
  for (let index = 0; index < optionTokens.length; index += 1) {
    const token = optionTokens[index];
    if (token === "--config") {
      parsed.configPath = takeValue(optionTokens, index, token);
      index += 1;
    } else if (token === "--issue") {
      parsed.issue = takeValue(optionTokens, index, token);
      index += 1;
    } else if (token === "--expect") {
      parsed.expectation = takeValue(optionTokens, index, token);
      if (!["fail", "pass"].includes(parsed.expectation)) throw new Error("--expect must be fail or pass.");
      index += 1;
    } else if (token === "--runs") {
      parsed.runs = parseInteger(takeValue(optionTokens, index, token), token, 2, 20);
      index += 1;
    } else if (token === "--timeout") {
      parsed.timeoutSeconds = parseInteger(takeValue(optionTokens, index, token), token, 1, 3_600);
      index += 1;
    } else if (token === "--max-output-kb") {
      parsed.maxOutputKb = parseInteger(takeValue(optionTokens, index, token), token, 1, 1_024);
      index += 1;
    } else if (token === "--isolation") {
      parsed.isolation = takeValue(optionTokens, index, token);
      if (!["tracked", "worktree"].includes(parsed.isolation)) {
        throw new Error("--isolation must be tracked or worktree.");
      }
      index += 1;
    } else if (token === "--force") {
      parsed.force = true;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  return parsed;
}

async function runInit(tokens) {
  const parsed = parseInit(tokens);
  const result = await createConfig(parsed.configPath, parsed.commandTokens, parsed);
  console.log(`Created ${result.path}`);
  console.log("Review the argv array, then run: issueproof verify");
  return 0;
}

async function readReceipt(file) {
  return JSON.parse(await readFile(path.resolve(file), "utf8"));
}

async function runCompare(tokens) {
  const json = tokens.includes("--json");
  const files = tokens.filter((token) => token !== "--json");
  if (files.length !== 2) throw new Error("Usage: issueproof compare [--json] <left.json> <right.json>");
  const [left, right] = await Promise.all(files.map(readReceipt));
  const result = compareReceipts(left, right);
  console.log(json ? JSON.stringify(result) : renderComparison(result));
  return ["same_failure", "failure_absent", "same_outcome"].includes(result.status) ? 0 : 1;
}

async function runAssess(tokens) {
  if (tokens.length !== 1) throw new Error("Usage: issueproof assess <issue.md>");
  const text = await readFile(path.resolve(tokens[0]), "utf8");
  const assessment = assessIssue(text);
  console.log(JSON.stringify(assessment, null, 2));
  return assessment.checklist.missingRequired.length === 0 ? 0 : 1;
}

async function runCheck(tokens) {
  if (tokens.length !== 1) throw new Error("Usage: issueproof check <receipt.json>");
  const receipt = await readReceipt(tokens[0]);
  const shapeErrors = validateReceiptShape(receipt);
  if (shapeErrors.length > 0) {
    console.error("invalid schema:");
    for (const error of shapeErrors) console.error(`- ${error}`);
    return 1;
  }
  const result = verifyReceipt(receipt);
  if (result.valid) {
    console.log(`valid: ${result.actual}`);
    return 0;
  }
  console.error(`invalid: ${result.reason}`);
  if (result.expected && result.actual) {
    console.error(`expected: ${result.expected}`);
    console.error(`actual:   ${result.actual}`);
  }
  return 1;
}

export async function main(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-V") {
    console.log(VERSION);
    return 0;
  }
  const [subcommand, ...tokens] = argv;
  if (subcommand === "init") return runInit(tokens);
  if (subcommand === "verify") return runVerify(tokens);
  if (subcommand === "compare") return runCompare(tokens);
  if (subcommand === "assess") return runAssess(tokens);
  if (subcommand === "check") return runCheck(tokens);
  throw new Error(`Unknown command: ${subcommand}. Run issueproof --help.`);
}
