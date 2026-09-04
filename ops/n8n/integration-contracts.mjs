import crypto from "node:crypto";

export const INTEGRATION_CONTRACTS = Object.freeze({
  github: Object.freeze({
    purpose: "workflow_run trigger and repository metadata",
    access: "read:repository-metadata",
    writes: [],
    costClass: "free",
    idempotency: "x-github-delivery",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  jira: Object.freeze({
    purpose: "write a structured CI evidence comment to the validated issue",
    access: "issue:read comment:write",
    writes: ["comment"],
    costClass: "free",
    idempotency: "delivery-id plus commit SHA",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  confluence: Object.freeze({
    purpose: "review and update the existing project documentation page",
    access: "page:read comment:write",
    writes: ["footer-comment"],
    costClass: "free",
    idempotency: "page-id plus version",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  supabase: Object.freeze({
    purpose: "validate isolated test data for the PoC",
    access: "test-data:read",
    writes: [],
    costClass: "free",
    idempotency: "read-only",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
});

export function isRetryableIntegrationStatus(status) {
  return Object.values(INTEGRATION_CONTRACTS).some((contract) =>
    contract.retryableErrors.includes(status),
  );
}

export function getRetryDelayMs(attempt, { baseMs = 250, maxMs = 10_000 } = {}) {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new TypeError("attempt must be a non-negative integer");
  }

  return Math.min(baseMs * 2 ** attempt, maxMs);
}

export function createIntegrationIdempotencyKey(parts) {
  const serialized = parts.map((part) => String(part ?? "")).join("|");
  return crypto.createHash("sha256").update(serialized).digest("hex");
}
