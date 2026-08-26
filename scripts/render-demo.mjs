import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repositoryRoot, "bin", "issueproof.js");
const example = path.join(repositoryRoot, "examples", "stable-failure.js");
const assets = path.join(repositoryRoot, "docs", "assets");
const workspace = mkdtempSync(path.join(os.tmpdir(), "issueproof-demo-"));

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
  return result;
}

function renderSvg(lines) {
  const rows = lines
    .map(({ text, color = "#c9d1d9", weight = "400" }, index) => {
      const y = 112 + index * 42;
      return `<text x="46" y="${y}" fill="${color}" font-family="Menlo, Monaco, monospace" font-size="18" font-weight="${weight}">${escapeXml(text)}</text>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560">
  <rect width="1000" height="560" rx="18" fill="#0d1117"/>
  <rect width="1000" height="58" rx="18" fill="#161b22"/>
  <rect y="40" width="1000" height="18" fill="#161b22"/>
  <circle cx="30" cy="29" r="8" fill="#ff5f56"/>
  <circle cx="56" cy="29" r="8" fill="#ffbd2e"/>
  <circle cx="82" cy="29" r="8" fill="#27c93f"/>
  <text x="500" y="36" text-anchor="middle" fill="#8b949e" font-family="Menlo, Monaco, monospace" font-size="15">IssueProof — reproducible evidence</text>
  ${rows}
</svg>`;
}

try {
  const receiptRoot = path.join(workspace, "receipts");
  const verification = run(process.execPath, [
    cli,
    "verify",
    "--json",
    "--no-config",
    "--runs",
    "3",
    "--output",
    receiptRoot,
    "--",
    process.execPath,
    example,
  ], { cwd: repositoryRoot });
  const summary = JSON.parse(verification.stdout);
  const progress = verification.stderr.trim().split(/\r?\n/);
  if (summary.verdict !== "stable_failure" || progress.length !== 3) {
    throw new Error("Demo verification did not produce the expected stable failure.");
  }

  const command = { text: "$ npx issueproof verify -- node examples/stable-failure.js", color: "#f0f6fc" };
  const progressLines = progress.map((text) => ({ text, color: "#8b949e" }));
  const verdict = { text: `${summary.verdict}: ${summary.summary}`, color: "#3fb950", weight: "700" };
  const receipt = { text: "Receipt: .issueproof/receipts/<id>/receipt.md", color: "#58a6ff" };
  const machine = { text: "Machine-readable: .issueproof/receipts/<id>/receipt.json", color: "#58a6ff" };
  const tagline = { text: "Same failure. Three observations. Reviewable evidence.", color: "#d2a8ff", weight: "700" };
  const stages = [
    [command],
    [command, progressLines[0]],
    [command, progressLines[0], progressLines[1]],
    [command, ...progressLines],
    [command, ...progressLines, verdict],
    [command, ...progressLines, verdict, receipt],
    [command, ...progressLines, verdict, receipt, machine],
    [command, ...progressLines, verdict, receipt, machine, tagline],
    [command, ...progressLines, verdict, receipt, machine, tagline],
  ];

  stages.forEach((stage, index) => {
    const stem = `frame-${String(index).padStart(2, "0")}`;
    const svg = path.join(workspace, `${stem}.svg`);
    writeFileSync(svg, renderSvg(stage));
    run("qlmanage", ["-t", "-s", "1000", "-o", workspace, svg]);
    copyFileSync(`${svg}.png`, path.join(workspace, `${stem}.png`));
  });

  mkdirSync(assets, { recursive: true });
  const output = path.join(assets, "issueproof-demo.gif");
  run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-framerate",
    "1",
    "-i",
    path.join(workspace, "frame-%02d.png"),
    "-vf",
    "crop=1000:560:0:0,fps=12,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer",
    "-loop",
    "0",
    output,
  ]);

  const bytes = readFileSync(output).byteLength;
  console.log(`rendered ${path.relative(repositoryRoot, output)} (${Math.round(bytes / 1024)} KiB)`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
