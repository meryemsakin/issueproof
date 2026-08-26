import { createHash, timingSafeEqual } from "node:crypto";

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

export function canonicalPayload(receipt) {
  const { integrity: _integrity, ...payload } = receipt;
  return JSON.stringify(sortValue(payload));
}

export function receiptHash(receipt) {
  return createHash("sha256").update(canonicalPayload(receipt)).digest("hex");
}

export function sealReceipt(receipt) {
  return {
    ...receipt,
    integrity: {
      algorithm: "sha256",
      payloadHash: receiptHash(receipt),
      scope: "canonical JSON excluding the integrity field",
    },
  };
}

export function verifyReceipt(receipt) {
  const expected = receipt?.integrity?.payloadHash;
  if (receipt?.integrity?.algorithm !== "sha256" || typeof expected !== "string") {
    return { valid: false, reason: "Receipt has no supported integrity seal." };
  }
  const actual = receiptHash(receipt);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  const valid = expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
  return { valid, expected, actual, reason: valid ? null : "Receipt payload has changed since it was sealed." };
}

export function validateReceiptShape(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return ["Receipt must be a JSON object."];
  if (receipt.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0.");
  if (typeof receipt.id !== "string" || receipt.id.length < 8) errors.push("id is missing or invalid.");
  if (receipt.tool?.name !== "issueproof") errors.push("tool.name must be issueproof.");
  if (typeof receipt.verdict?.name !== "string") errors.push("verdict.name is missing.");
  if (typeof receipt.verdict?.verified !== "boolean") errors.push("verdict.verified must be boolean.");
  if (!Array.isArray(receipt.runs) || receipt.runs.length === 0) errors.push("runs must contain at least one attempt.");
  if (!receipt.reproduction?.command?.executable) errors.push("reproduction.command.executable is missing.");
  if (!receipt.environment || typeof receipt.environment !== "object") errors.push("environment is missing.");
  return errors;
}
