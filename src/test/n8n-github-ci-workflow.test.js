import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createWebhookVerifier,
  hasValidSignature,
  isCompletedWorkflowRun,
} from "../../ops/n8n/webhook-verifier.mjs";

const workflowPath = path.resolve(
  process.cwd(),
  "ops/n8n/workflows/github-ci-to-jira.json",
);
const composePath = path.resolve(process.cwd(), "ops/n8n/docker-compose.yml");
const caddyPath = path.resolve(process.cwd(), "ops/n8n/Caddyfile");

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(workflowPath, "utf8"));
}

function createSignature(rawPayload, secret) {
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex")}`;
}

function runJiraKeyExtraction(body) {
  const workflow = loadWorkflow();
  const extractor = workflow.nodes.find((node) => node.id === "kan134-validate");
  const execute = new Function("$json", extractor.parameters.jsCode);

  return execute({ body })[0].json;
}

describe("KAN-134 GitHub CI to Jira workflow", () => {
  it("isolates the webhook secret from n8n", () => {
    const compose = fs.readFileSync(composePath, "utf8");
    const n8nService = compose.split("  webhook-verifier:")[0];

    expect(n8nService).not.toContain("GITHUB_WEBHOOK_SECRET");
    expect(n8nService).not.toContain("N8N_BLOCK_ENV_ACCESS_IN_NODE=false");
    expect(compose).toContain(
      "GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET:?set the GitHub webhook secret}",
    );
    expect(fs.readFileSync(caddyPath, "utf8")).toContain(
      "reverse_proxy webhook-verifier:3000",
    );
  });

  it("uses scoped Jira Basic Auth through Atlassian's API gateway", () => {
    const workflow = loadWorkflow();
    const jiraRequest = workflow.nodes.find((node) => node.id === "kan134-jira-comment");

    expect(jiraRequest.parameters).toMatchObject({
      authentication: "genericCredentialType",
      genericAuthType: "httpBasicAuth",
    });
    expect(jiraRequest.parameters.url).toContain("https://api.atlassian.com/ex/jira/");
    expect(jiraRequest.credentials).toEqual({
      httpBasicAuth: { name: "jiraApiToken" },
    });
  });

  it("extracts a Jira key without granting n8n secret access", () => {
    expect(
      runJiraKeyExtraction({
        workflow_run: {
          head_branch: "feature/KAN-134-poc",
          id: 42,
          conclusion: "success",
        },
      }),
    ).toMatchObject({ jiraKey: "KAN-134", runId: 42, ai_calls: 0 });
    expect(
      runJiraKeyExtraction({ workflow_run: { head_branch: "main", id: 43 } }),
    ).toMatchObject({ jiraKey: null, runId: 43, ai_calls: 0 });
  });

  it("validates GitHub's signature against the exact raw body", () => {
    const secret = "test-only-secret";
    const rawPayload = Buffer.from('{\n  "action": "completed"\n}');

    expect(hasValidSignature(rawPayload, createSignature(rawPayload, secret), secret)).toBe(
      true,
    );
    expect(
      hasValidSignature(rawPayload, `sha256=${"0".repeat(64)}`, secret),
    ).toBe(false);
  });

  it.each(["requested", "in_progress"])(
    "does not process the signed %s lifecycle event",
    (action) => {
      expect(
        isCompletedWorkflowRun(
          { "x-github-event": "workflow_run" },
          { action },
        ),
      ).toBe(false);
    },
  );

  it("accepts only a completed workflow_run event", () => {
    expect(
      isCompletedWorkflowRun(
        { "x-github-event": "workflow_run" },
        { action: "completed" },
      ),
    ).toBe(true);
    expect(
      isCompletedWorkflowRun(
        { "x-github-event": "push" },
        { action: "completed" },
      ),
    ).toBe(false);
  });

  it("forwards a signed completed delivery exactly once", async () => {
    const secret = "test-only-secret";
    const forwardedBodies = [];
    const server = createWebhookVerifier({
      secret,
      targetUrl: "http://n8n.invalid/webhook/github-ci-to-jira",
      fetchImpl: async (_url, options) => {
        forwardedBodies.push(options.body.toString("utf8"));
        return { ok: true };
      },
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      const send = async (action, deliveryId, signatureOverride) => {
        const body = JSON.stringify({ action, workflow_run: { id: 42 } });
        return fetch(`http://127.0.0.1:${port}/webhook/github-ci-to-jira`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-github-event": "workflow_run",
            "x-github-delivery": deliveryId,
            "x-hub-signature-256": signatureOverride ?? createSignature(body, secret),
          },
          body,
        });
      };

      expect((await send("requested", "delivery-requested")).status).toBe(202);
      expect(
        (await send("completed", "delivery-invalid", `sha256=${"0".repeat(64)}`)).status,
      ).toBe(401);
      expect((await send("completed", "delivery-completed")).status).toBe(202);
      expect((await send("completed", "delivery-completed")).status).toBe(202);
      expect(forwardedBodies).toEqual([
        JSON.stringify({ action: "completed", workflow_run: { id: 42 } }),
      ]);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("keeps all secret and signature logic outside the n8n workflow export", () => {
    const serializedWorkflow = JSON.stringify(loadWorkflow());

    expect(serializedWorkflow).not.toContain("GITHUB_WEBHOOK_SECRET");
    expect(serializedWorkflow).not.toContain("$env");
    expect(serializedWorkflow).not.toContain("require('crypto')");
  });
});
