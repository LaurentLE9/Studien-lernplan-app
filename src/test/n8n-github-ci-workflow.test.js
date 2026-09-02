import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = path.resolve(
  process.cwd(),
  "ops/n8n/workflows/github-ci-to-jira.json",
);

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(workflowPath, "utf8"));
}

function runValidation({ rawPayload, secret, signature }) {
  const workflow = loadWorkflow();
  const webhook = workflow.nodes.find((node) => node.id === "kan134-webhook");
  const validator = workflow.nodes.find((node) => node.id === "kan134-validate");
  const payload = JSON.parse(rawPayload);
  const execute = new Function(
    "$json",
    "$env",
    "$binary",
    "require",
    validator.parameters.jsCode,
  );

  return {
    webhook,
    result: execute(
      { headers: { "x-hub-signature-256": signature }, body: payload },
      { GITHUB_WEBHOOK_SECRET: secret },
      { data: { data: Buffer.from(rawPayload).toString("base64") } },
      (moduleName) => {
        if (moduleName !== "crypto") throw new Error(`Unexpected module: ${moduleName}`);
        return crypto;
      },
    )[0].json,
  };
}

describe("KAN-134 GitHub CI to Jira workflow", () => {
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

  it("validates GitHub's signature against the exact raw body", () => {
    const secret = "test-only-secret";
    const rawPayload = '{\n  "workflow_run": {"head_branch":"feature/KAN-134-poc","id":42}\n}';
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(rawPayload)
      .digest("hex")}`;
    const { webhook, result } = runValidation({ rawPayload, secret, signature });

    expect(webhook.parameters.options.rawBody).toBe(true);
    expect(result).toMatchObject({ valid: true, jiraKey: "KAN-134", runId: 42, ai_calls: 0 });
  });

  it("rejects an invalid signature before the Jira path", () => {
    const { result } = runValidation({
      rawPayload: '{"workflow_run":{"head_branch":"feature/KAN-134-poc"}}',
      secret: "test-only-secret",
      signature: `sha256=${"0".repeat(64)}`,
    });

    expect(result.valid).toBe(false);
  });
});
