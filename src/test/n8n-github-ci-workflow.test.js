import crypto from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createFileDeliveryStore,
  createWebhookVerifier,
  hasValidSignature,
  isCompletedWorkflowRun,
  isTrustedWorkflowRun,
  MAX_BODY_BYTES,
  normalizeSingleHeader,
} from "../../ops/n8n/webhook-verifier.mjs";

const expectedRepository = "LaurentLE9/Studien-lernplan-app";
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

function createPayload({
  action = "completed",
  repository = expectedRepository,
  headRepository = expectedRepository,
  branch = "feature/KAN-156-hardening",
} = {}) {
  return {
    action,
    repository: { full_name: repository },
    workflow_run: {
      id: 42,
      head_branch: branch,
      head_repository: { full_name: headRepository },
    },
  };
}

async function startVerifier({ fetchImpl, directory }) {
  const server = createWebhookVerifier({
    secret: "test-only-secret",
    targetUrl: "http://n8n.invalid/webhook/github-ci-to-jira",
    expectedRepository,
    deliveryStore: createFileDeliveryStore(directory),
    fetchImpl,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function closeServer(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function sendDelivery(
  server,
  {
    payload = createPayload(),
    deliveryId = "delivery-1",
    pathSuffix = "",
    signatureOverride,
    rawBody,
  } = {},
) {
  const body = rawBody ?? JSON.stringify(payload);
  const { port } = server.address();
  return fetch(
    `http://127.0.0.1:${port}/webhook/github-ci-to-jira${pathSuffix}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        ...(deliveryId ? { "x-github-delivery": deliveryId } : {}),
        "x-hub-signature-256":
          signatureOverride ?? createSignature(body, "test-only-secret"),
      },
      body,
    },
  );
}

describe("KAN-156 GitHub CI to Jira workflow hardening", () => {
  it("isolates secrets, persists delivery state, and blocks direct webhook ingress", () => {
    const compose = fs.readFileSync(composePath, "utf8");
    const n8nService = compose.split("  webhook-verifier:")[0];
    const caddy = fs.readFileSync(caddyPath, "utf8");

    expect(n8nService).not.toContain("GITHUB_WEBHOOK_SECRET");
    expect(n8nService).not.toContain("N8N_BLOCK_ENV_ACCESS_IN_NODE=false");
    expect(compose).toContain(
      "GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET:?set the GitHub webhook secret}",
    );
    expect(compose).toContain(
      "GITHUB_EXPECTED_REPOSITORY=${GITHUB_EXPECTED_REPOSITORY:?set the trusted owner/repository}",
    );
    expect(compose).toContain("verifier_data:/var/lib/webhook-verifier");
    expect(caddy).toContain("reverse_proxy webhook-verifier:3000");
    expect(caddy).toContain("@blocked_webhooks path /webhook* /webhook-test*");
  });

  it("uses scoped Jira auth and waits for the terminal Jira node", () => {
    const workflow = loadWorkflow();
    const webhook = workflow.nodes.find((node) => node.id === "kan134-webhook");
    const jiraRequest = workflow.nodes.find((node) => node.id === "kan134-jira-comment");

    expect(webhook.parameters.responseMode).toBe("lastNode");
    expect(jiraRequest.parameters).toMatchObject({
      authentication: "genericCredentialType",
      genericAuthType: "httpBasicAuth",
    });
    expect(jiraRequest.parameters.url).toContain("https://api.atlassian.com/ex/jira/");
    expect(jiraRequest.credentials).toEqual({
      httpBasicAuth: { name: "jiraApiToken" },
    });
  });

  it("extracts the first Jira key across branch and commit metadata", () => {
    expect(
      runJiraKeyExtraction({
        workflow_run: {
          head_branch: "feature/KAN-156-hardening",
          head_commit: { message: "KAN-999 ignored because branch wins" },
          id: 42,
        },
      }),
    ).toMatchObject({ jiraKey: "KAN-156", runId: 42, ai_calls: 0 });
    expect(
      runJiraKeyExtraction({
        workflow_run: {
          head_branch: "main",
          head_commit: { message: "KAN-156: merge hardening" },
          id: 43,
        },
      }),
    ).toMatchObject({ jiraKey: "KAN-156", runId: 43, ai_calls: 0 });
    expect(
      runJiraKeyExtraction({ workflow_run: { head_branch: "main", id: 44 } }),
    ).toMatchObject({ jiraKey: null, runId: 44, ai_calls: 0 });
  });

  it("normalizes exactly one header value and fails closed for multiples", () => {
    const value = "sha256=value";

    expect(normalizeSingleHeader(value)).toBe(value);
    expect(normalizeSingleHeader([value])).toBe(value);
    expect(normalizeSingleHeader([value, value])).toBeNull();
    expect(normalizeSingleHeader(undefined)).toBeNull();
    expect(() =>
      hasValidSignature(Buffer.from("{}"), [value, value], "test-only-secret"),
    ).not.toThrow();
    expect(
      hasValidSignature(Buffer.from("{}"), [value, value], "test-only-secret"),
    ).toBe(false);
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

  it("accepts only completed workflow_run lifecycle events", () => {
    expect(
      isCompletedWorkflowRun(
        { "x-github-event": "workflow_run" },
        { action: "completed" },
      ),
    ).toBe(true);
    expect(
      isCompletedWorkflowRun(
        { "x-github-event": ["workflow_run", "workflow_run"] },
        { action: "completed" },
      ),
    ).toBe(false);
    expect(
      isCompletedWorkflowRun(
        { "x-github-event": "push" },
        { action: "completed" },
      ),
    ).toBe(false);
  });

  it("requires both the base and head repository to be trusted", () => {
    expect(isTrustedWorkflowRun(createPayload(), expectedRepository)).toBe(true);
    expect(
      isTrustedWorkflowRun(
        createPayload({ headRepository: "attacker/fork" }),
        expectedRepository,
      ),
    ).toBe(false);
    expect(
      isTrustedWorkflowRun(
        createPayload({ repository: "attacker/other" }),
        expectedRepository,
      ),
    ).toBe(false);
  });

  it("forwards a signed trusted completed delivery and accepts query parameters", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    const forwardedBodies = [];
    const server = await startVerifier({
      directory,
      fetchImpl: async (_url, options) => {
        forwardedBodies.push(options.body.toString("utf8"));
        return { ok: true };
      },
    });

    try {
      expect(
        (await sendDelivery(server, { pathSuffix: "?source=github" })).status,
      ).toBe(202);
      expect(forwardedBodies).toEqual([JSON.stringify(createPayload())]);
    } finally {
      await closeServer(server);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects signed fork metadata and missing delivery IDs without forwarding", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    let forwardCount = 0;
    const server = await startVerifier({
      directory,
      fetchImpl: async () => {
        forwardCount += 1;
        return { ok: true };
      },
    });

    try {
      expect(
        (
          await sendDelivery(server, {
            payload: createPayload({ headRepository: "attacker/fork" }),
            deliveryId: "fork-delivery",
          })
        ).status,
      ).toBe(403);
      expect(
        (await sendDelivery(server, { deliveryId: null })).status,
      ).toBe(400);
      expect(forwardCount).toBe(0);
    } finally {
      await closeServer(server);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("returns 413 for an oversized body and never forwards it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    let forwardCount = 0;
    const server = await startVerifier({
      directory,
      fetchImpl: async () => {
        forwardCount += 1;
        return { ok: true };
      },
    });

    try {
      const response = await sendDelivery(server, {
        deliveryId: "oversized",
        rawBody: "x".repeat(MAX_BODY_BYTES + 1),
      });
      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({
        accepted: false,
        error: "payload_too_large",
      });
      expect(forwardCount).toBe(0);
    } finally {
      await closeServer(server);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("atomically suppresses concurrent duplicate deliveries", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    let releaseUpstream;
    let markStarted;
    const upstreamStarted = new Promise((resolve) => {
      markStarted = resolve;
    });
    const upstreamReleased = new Promise((resolve) => {
      releaseUpstream = resolve;
    });
    let forwardCount = 0;
    const server = await startVerifier({
      directory,
      fetchImpl: async () => {
        forwardCount += 1;
        markStarted();
        await upstreamReleased;
        return { ok: true };
      },
    });

    try {
      const first = sendDelivery(server, { deliveryId: "concurrent" });
      await upstreamStarted;
      const duplicate = await sendDelivery(server, { deliveryId: "concurrent" });
      releaseUpstream();
      expect(duplicate.status).toBe(202);
      expect(await duplicate.json()).toMatchObject({ duplicate: true });
      expect((await first).status).toBe(202);
      expect(forwardCount).toBe(1);
    } finally {
      await closeServer(server);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("persists completed delivery IDs across verifier restarts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    let forwardCount = 0;
    const fetchImpl = async () => {
      forwardCount += 1;
      return { ok: true };
    };
    const firstServer = await startVerifier({ directory, fetchImpl });

    try {
      expect(
        (await sendDelivery(firstServer, { deliveryId: "persistent" })).status,
      ).toBe(202);
    } finally {
      await closeServer(firstServer);
    }

    const restartedServer = await startVerifier({ directory, fetchImpl });
    try {
      const duplicate = await sendDelivery(restartedServer, {
        deliveryId: "persistent",
      });
      expect(duplicate.status).toBe(202);
      expect(await duplicate.json()).toMatchObject({ duplicate: true });
      expect(forwardCount).toBe(1);
    } finally {
      await closeServer(restartedServer);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("releases a reservation when n8n does not confirm the Jira workflow", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-156-"));
    let forwardCount = 0;
    const server = await startVerifier({
      directory,
      fetchImpl: async () => {
        forwardCount += 1;
        return { ok: forwardCount > 1 };
      },
    });

    try {
      expect(
        (await sendDelivery(server, { deliveryId: "retryable" })).status,
      ).toBe(502);
      expect(
        (await sendDelivery(server, { deliveryId: "retryable" })).status,
      ).toBe(202);
      expect(forwardCount).toBe(2);
    } finally {
      await closeServer(server);
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps all secret and signature logic outside the n8n workflow export", () => {
    const serializedWorkflow = JSON.stringify(loadWorkflow());

    expect(serializedWorkflow).not.toContain("GITHUB_WEBHOOK_SECRET");
    expect(serializedWorkflow).not.toContain("$env");
    expect(serializedWorkflow).not.toContain("require('crypto')");
  });
});
