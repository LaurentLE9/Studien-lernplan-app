import { describe, expect, it } from "vitest";
import {
  createIntegrationIdempotencyKey,
  getRetryDelayMs,
  INTEGRATION_CONTRACTS,
  INTEGRATION_PROBE_OPERATIONS,
  isRetryableIntegrationStatus,
  probeIntegration,
} from "../../ops/n8n/integration-contracts.mjs";
import fs from "node:fs";
import path from "node:path";

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
    expect(INTEGRATION_CONTRACTS.confluence.writes).toEqual([]);
    expect(INTEGRATION_CONTRACTS.jira.writes).toEqual(["comment"]);
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

  it("probes only allowed read operations with deterministic retry handling", async () => {
    const requests = [];
    const delays = [];
    const result = await probeIntegration({
      system: "jira",
      request: async (request) => {
        requests.push(request);
        return requests.length === 1 ? { ok: false, status: 429 } : { ok: true, status: 200 };
      },
      delay: async (milliseconds) => delays.push(milliseconds),
    });

    expect(result).toEqual({
      system: "jira",
      operation: INTEGRATION_PROBE_OPERATIONS.jira,
      status: 200,
      outcome: "completed",
      attempts: 2,
    });
    expect(requests).toEqual([
      { system: "jira", operation: "issue-read" },
      { system: "jira", operation: "issue-read" },
    ]);
    expect(delays).toEqual([250]);
  });

  it("rejects undeclared operations and returns a secret-free failure result", async () => {
    await expect(
      probeIntegration({ system: "supabase", operation: "delete-user", request: async () => ({ ok: true, status: 200 }) }),
    ).rejects.toThrow("integration operation is not allowed by the contract");

    await expect(
      probeIntegration({ system: "confluence", request: async () => ({ ok: false, status: 403 }) }),
    ).resolves.toEqual({
      system: "confluence",
      operation: "page-read",
      status: 403,
      outcome: "failed",
      attempts: 1,
    });
  });

  it("keeps the executable probe inactive, read-only, retried and credential-value-free", () => {
    const workflowPath = path.resolve(process.cwd(), "ops/n8n/workflows/integration-contract-probe.json");
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

    expect(workflow.active).toBe(false);
    expect(workflow.nodes.map((node) => node.name)).toEqual([
      "Manuell starten",
      "Probe-Konfiguration",
      "GitHub Repository-Metadaten lesen",
      "Jira-Vorgang lesen",
      "Confluence-Seite lesen",
      "Isolierte Supabase-Testdaten lesen",
    ]);
    for (const node of workflow.nodes.slice(2)) {
      expect(node.parameters.method).toBe("GET");
      expect(node.parameters.url).toContain('$node["Probe-Konfiguration"]');
      expect(node.retryOnFail).toBe(true);
      expect(node.maxTries).toBe(3);
      expect(JSON.stringify(node)).not.toMatch(/Bearer\s|gh[pous]_|sbp_|eyJ[a-z0-9_-]{10,}/i);
    }
    const githubNode = workflow.nodes.find((node) => node.id === "kan131-github-read");
    const supabaseNode = workflow.nodes.find((node) => node.id === "kan131-supabase-read");
    expect(githubNode.parameters.authentication).toBe("none");
    expect(githubNode.credentials).toBeUndefined();
    expect(supabaseNode.credentials).toEqual({
      httpHeaderAuth: { name: "supabaseTestReadOnly" },
    });
    expect(workflow.connections["Probe-Konfiguration"].main[0].map(({ node }) => node)).toEqual([
      "GitHub Repository-Metadaten lesen",
      "Jira-Vorgang lesen",
      "Confluence-Seite lesen",
      "Isolierte Supabase-Testdaten lesen",
    ]);
    expect(workflow.connections["GitHub Repository-Metadaten lesen"]).toBeUndefined();
    expect(workflow.connections["Jira-Vorgang lesen"]).toBeUndefined();
    expect(workflow.connections["Confluence-Seite lesen"]).toBeUndefined();
    const serializedWorkflow = JSON.stringify(workflow);
    expect(serializedWorkflow).not.toContain("githubReadOnly");
    expect(serializedWorkflow).not.toContain("$vars.");
    expect(serializedWorkflow).not.toContain("$env.");
  });
});
