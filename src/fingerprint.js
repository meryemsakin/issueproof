import { createHash } from "node:crypto";

const SIGNAL_LINE = /\b(error|exception|failed|failure|fatal|panic|traceback|assert(?:ion)?)\b/i;

export function normalizeFailureOutput(value) {
  return value
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "<timestamp>")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g, "<time>")
    .replace(/\b(?:pid|process)\s*[=:]?\s*\d+\b/gi, "pid=<pid>")
    .replace(/\b0x[0-9a-f]+\b/gi, "<address>")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|milliseconds?|seconds?|secs?|s)\b/gi, "<duration>")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function extractFailureSignature(value, maxLines = 30) {
  const lines = normalizeFailureOutput(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const signalIndexes = lines.flatMap((line, index) => (SIGNAL_LINE.test(line) ? [index] : []));

  if (signalIndexes.length === 0) return lines.slice(-maxLines).join("\n");

  const selected = new Set();
  for (const index of signalIndexes) {
    for (let offset = -1; offset <= 2; offset += 1) {
      if (lines[index + offset]) selected.add(index + offset);
    }
  }
  return [...selected]
    .sort((a, b) => a - b)
    .slice(-maxLines)
    .map((index) => lines[index])
    .join("\n");
}

export function fingerprint(exitCode, output) {
  const signature = extractFailureSignature(output);
  const hash = createHash("sha256").update(`${exitCode}\n${signature}`).digest("hex");
  return { hash, signature };
}
