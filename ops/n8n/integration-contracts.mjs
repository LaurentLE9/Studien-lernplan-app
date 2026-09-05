import crypto from "node:crypto";

export const INTEGRATION_CONTRACTS = Object.freeze({
  github: Object.freeze({
    purpose: "workflow_run trigger and repository metadata",
    access: "read:repository-metadata",
    writes: [],
    operations: Object.freeze(["repository-read"]),
    costClass: "free",
    idempotency: "x-github-delivery",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  jira: Object.freeze({
    purpose: "write a structured CI evidence comment to the validated issue",
    access: "issue:read comment:write",
    writes: ["comment"],
    operations: Object.freeze(["issue-read", "ci-evidence-comment"]),
    costClass: "free",
    idempotency: "delivery-id plus commit SHA",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  confluence: Object.freeze({
    purpose: "review the existing project documentation page",
    access: "page:read",
    writes: [],
    operations: Object.freeze(["page-read"]),
    costClass: "free",
    idempotency: "page-id plus version",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
  supabase: Object.freeze({
    purpose: "validate isolated test data for the PoC",
    access: "test-data:read",
    writes: [],
    operations: Object.freeze(["isolated-test-data-read"]),
    costClass: "free",
    idempotency: "read-only",
    retryableErrors: [408, 425, 429, 500, 502, 503, 504],
  }),
});

export const INTEGRATION_PROBE_OPERATIONS = Object.freeze({
  github: "repository-read",
  jira: "issue-read",
  confluence: "page-read",
  supabase: "isolated-test-data-read",
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

export function isAllowedIntegrationOperation(system, operation) {
  return INTEGRATION_CONTRACTS[system]?.operations.includes(operation) ?? false;
}

export async function probeIntegration({
  system,
  operation = INTEGRATION_PROBE_OPERATIONS[system],
  request,
  delay = async () => {},
  maxAttempts = 3,
}) {
  if (!isAllowedIntegrationOperation(system, operation)) {
    throw new TypeError("integration operation is not allowed by the contract");
  }
  if (typeof request !== "function") {
    throw new TypeError("request must be a function");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  let lastStatus = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await request({ system, operation });
      lastStatus = Number(response?.status ?? 0);
      if (response?.ok) {
        return { system, operation, status: lastStatus, outcome: "completed", attempts: attempt + 1 };
      }
    } catch {
      lastStatus = 0;
    }

    if (!isRetryableIntegrationStatus(lastStatus) || attempt === maxAttempts - 1) {
      return { system, operation, status: lastStatus, outcome: "failed", attempts: attempt + 1 };
    }
    await delay(getRetryDelayMs(attempt));
  }

  return { system, operation, status: lastStatus, outcome: "failed", attempts: maxAttempts };
}
