import { describe, expect, it } from "vitest";
import {
  createIntegrationIdempotencyKey,
  getRetryDelayMs,
  INTEGRATION_CONTRACTS,
  isRetryableIntegrationStatus,
} from "../../ops/n8n/integration-contracts.mjs";

describe("KAN-131 integration contracts", () => {
  it("defines only free, least-privilege PoC access", () => {
    expect(Object.keys(INTEGRATION_CONTRACTS)).toEqual([
      "github",
      "jira",
      "confluence",
      "supabase",
    ]);

    for (const contract of Object.values(INTEGRATION_CONTRACTS)) {
      expect(contract.costClass).toBe("free");
      expect(contract.access).not.toMatch(/admin|service-role|delete|manage/i);
      expect(contract.purpose).not.toMatch(/secret|token|password/i);
    }

    expect(INTEGRATION_CONTRACTS.github.writes).toEqual([]);
    expect(INTEGRATION_CONTRACTS.supabase.writes).toEqual([]);
    expect(INTEGRATION_CONTRACTS.jira.writes).toEqual(["comment"]);
    expect(INTEGRATION_CONTRACTS.confluence.writes).toEqual(["footer-comment"]);
  });

  it("classifies transient statuses and applies capped exponential backoff", () => {
    expect(isRetryableIntegrationStatus(429)).toBe(true);
    expect(isRetryableIntegrationStatus(503)).toBe(true);
    expect(isRetryableIntegrationStatus(400)).toBe(false);
    expect(getRetryDelayMs(0)).toBe(250);
    expect(getRetryDelayMs(3)).toBe(2_000);
    expect(getRetryDelayMs(20)).toBe(10_000);
  });

  it("creates stable, non-reversible idempotency keys without exposing inputs", () => {
    const first = createIntegrationIdempotencyKey(["delivery-1", "abc123"]);
    const second = createIntegrationIdempotencyKey(["delivery-1", "abc123"]);

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("delivery-1");
    expect(first).not.toContain("abc123");
  });
});
