import os from "node:os";

const SECRET_PATTERNS = [
  {
    name: "credential assignment",
    regex: /\b(api[_-]?key|access[_-]?token|auth[_-]?token|token|client[_-]?secret|password|passwd|secret)\b\s*[:=]\s*(["']?)[^\s,"'}]+\2/gi,
    replace: (_match, key) => `${key}=<redacted>`,
  },
  {
    name: "bearer token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replace: "Bearer <redacted>",
  },
  {
    name: "basic authorization",
    regex: /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi,
    replace: "Basic <redacted>",
  },
  {
    name: "URL credentials",
    regex: /\b(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi,
    replace: "$1<redacted>@",
  },
  {
    name: "JWT",
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: "<redacted:jwt>",
  },
  {
    name: "GitHub token",
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replace: "<redacted:github-token>",
  },
  {
    name: "AWS access key",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    replace: "<redacted:aws-key>",
  },
  {
    name: "private key",
    regex: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/g,
    replace: "<redacted:private-key>",
  },
];

export function stripAnsi(value) {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
}

export function redact(value, options = {}) {
  let text = stripAnsi(String(value));
  const matches = [];

  for (const pattern of SECRET_PATTERNS) {
    let count = 0;
    text = text.replace(pattern.regex, (...args) => {
      count += 1;
      return typeof pattern.replace === "function" ? pattern.replace(...args) : pattern.replace;
    });
    if (count > 0) matches.push({ pattern: pattern.name, count });
  }

  const cwd = options.cwd;
  const home = options.home ?? os.homedir();
  if (cwd && text.includes(cwd)) {
    const count = text.split(cwd).length - 1;
    text = text.split(cwd).join("<repo>");
    matches.push({ pattern: "repository path", count });
  }

  if (home && text.includes(home)) {
    const count = text.split(home).length - 1;
    text = text.split(home).join("<home>");
    matches.push({ pattern: "home directory", count });
  }

  return { text, matches };
}
