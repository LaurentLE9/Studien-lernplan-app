import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  classifyTask,
  createMemoryStateStore,
  createOpenAiCompatibleProvider,
  createRouterEngine,
  MONTHLY_BUDGET_EUR,
} from "../../ops/n8n/ai-router.mjs";
import { createRouterServer } from "../../ops/n8n/ai-router-server.mjs";

const workflowPath = path.resolve(process.cwd(), "ops/n8n/workflows/task-router.json");
const composePath = path.resolve(process.cwd(), "ops/n8n/docker-compose.yml");
const envPath = path.resolve(process.cwd(), "ops/n8n/.env.example");

function cheapTask(overrides = {}) {
  return {
    jobId: "job-1",
    type: "summarization",
    complexity: "low",
    risk: "low",
    readOnly: true,
    contextComplete: true,
    instructions: "summarize",
    content: "small input",
    ...overrides,
  };
}

function provider(overrides = {}) {
  return {
    model: "test/cheap-model",
    estimateMaximumCost: () => 0.1,
    complete: vi.fn(async () => ({ confidence: 0.9, result: { ok: true }, costEur: 0.04 })),
    ...overrides,
  };
}

describe("KAN-127 routing policy", () => {
  it.each([
    "ci_status_sync",
    "jira_key_extraction",
    "schema_validation",
    "status_mapping",
    "structured_metrics",
  ])("routes deterministic type %s without an LLM", (type) => {
    expect(classifyTask({ type, contextComplete: true })).toMatchObject({
      route: "deterministic",
      reason: "deterministic_rule",
    });
  });

  it.each([
    "classification",
    "structured_extraction",
    "summarization",
    "text_transformation",
    "read_only_analysis",
  ])("routes simple read-only type %s to the cheap model", (type) => {
    expect(classifyTask(cheapTask({ type }))).toMatchObject({ route: "cheap_model" });
  });

  it.each([
    [{ contextComplete: undefined }, "missing_context"],
    [{ readOnly: undefined }, "read_only_not_confirmed"],
  ])("fails closed when affirmative delegation metadata is missing: %#", (overrides, reason) => {
    expect(classifyTask(cheapTask(overrides))).toMatchObject({ route: "codex", reason });
  });

  it.each([
    "architecture",
    "authentication",
    "authorization",
    "database_migration",
    "destructive_change",
    "permissions",
    "rls",
    "secret",
    "security",
    "session",
  ])("escalates critical signal %s", (signal) => {
    expect(classifyTask(cheapTask({ riskSignals: [signal] }))).toMatchObject({
      route: "codex",
      risk: "high",
      reason: "critical_category",
    });
  });

  it.each([
    [{ contextComplete: false }, "missing_context"],
    [{ conflictingResults: true }, "conflicting_results"],
    [{ failureCount: 2 }, "repeated_provider_failure"],
    [{ containsSensitiveData: true }, "sensitive_data"],
    [{ repositoryWrite: true }, "repository_change"],
    [{ multipleDependentFiles: true }, "repository_change"],
    [{ destructive: true }, "high_risk"],
    [{ complexity: "high" }, "unsupported_or_complex"],
  ])("escalates policy case %#", (overrides, reason) => {
    expect(classifyTask(cheapTask(overrides))).toMatchObject({ route: "codex", reason });
  });
});

describe("KAN-127 execution, budget, and metrics", () => {
  it("rejects any configured budget above the 20 EUR policy ceiling", () => {
    expect(() =>
      createRouterEngine({
        stateStore: createMemoryStateStore(),
        provider: provider(),
        monthlyBudgetEur: 20.01,
      }),
    ).toThrow("monthlyBudgetEur must be between 0 and 20");
  });

  it("does not call a provider for deterministic work", async () => {
    const model = provider();
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: model });
    const result = await engine.execute({ type: "ci_status_sync", contextComplete: true });

    expect(result).toMatchObject({ status: "completed", route: "deterministic", model: null });
    expect(model.complete).not.toHaveBeenCalled();
  });

  it("routes an automatically selected Sol task to Codex without calling a provider", async () => {
    const model = provider();
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: model });
    const result = await engine.execute({
      ...cheapTask(),
      requiredModel: "sol",
    });

    expect(result).toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "required_model_sol",
    });
    expect(result).not.toHaveProperty("userMessage");
    expect(model.complete).not.toHaveBeenCalled();
  });

  it("normalizes a successful cheap-model result and reports safe metrics", async () => {
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: provider() });
    const result = await engine.execute(cheapTask());
    const metrics = await engine.metrics();

    expect(result).toMatchObject({
      status: "completed",
      route: "cheap_model",
      model: "test/cheap-model",
      confidence: 0.9,
      estimated_cost: 0.04,
    });
    expect(metrics).toMatchObject({
      monthlyBudgetEur: MONTHLY_BUDGET_EUR,
      spentEur: 0.04,
      modelCalls: 1,
      avoidedCodexCalls: 1,
      escalations: 0,
      errors: 0,
      models: { "test/cheap-model": 1 },
    });
    expect(JSON.stringify(metrics)).not.toContain("small input");
    expect(JSON.stringify(metrics)).not.toContain("summarize");
  });

  it("escalates an artificial low-confidence result", async () => {
    const engine = createRouterEngine({
      stateStore: createMemoryStateStore(),
      provider: provider({
        complete: vi.fn(async () => ({ confidence: 0.2, result: { unsafe: "discard" }, costEur: 0.01 })),
      }),
    });

    await expect(engine.execute(cheapTask())).resolves.toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "low_confidence",
      result: {},
    });
  });

  it("fails closed on provider errors and conservatively charges the reservation", async () => {
    const engine = createRouterEngine({
      stateStore: createMemoryStateStore(),
      provider: provider({ complete: vi.fn(async () => { throw new Error("timeout"); }) }),
    });

    await expect(engine.execute(cheapTask())).resolves.toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "provider_failure",
    });
    await expect(engine.metrics()).resolves.toMatchObject({
      reservedEur: 0,
      spentEur: 0.1,
      modelCalls: 1,
      errors: 1,
    });
  });

  it.each([undefined, "not-a-number", Number.NaN, -0.1, 1.1])(
    "fails closed for invalid provider confidence %s",
    async (confidence) => {
      const engine = createRouterEngine({
        stateStore: createMemoryStateStore(),
        provider: provider({
          complete: vi.fn(async () => ({ confidence, result: { unsafe: true }, costEur: 0.01 })),
        }),
      });

      await expect(engine.execute(cheapTask())).resolves.toMatchObject({
        status: "escalate",
        route: "codex",
        reason: "provider_failure",
        result: {},
        estimated_cost: 0.1,
      });
    },
  );

  it("records manual switches separately from automatic runtime selections", async () => {
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: provider() });
    await engine.recordModelDecision({
      status: "MODEL_SWITCH_REQUIRED",
      currentModel: "luna",
      requiredModel: "terra",
      reasonCategory: "complexity_or_uncertainty",
    });
    await engine.recordModelDecision({
      status: "ROUTE_SELECTED",
      currentModel: null,
      requiredModel: "sol",
      reasonCategory: "security_or_data_risk",
    });

    await expect(engine.metrics()).resolves.toMatchObject({
      manualInterventions: 1,
      modelRouting: {
        decisionsTotal: 2,
        switchRequiredCount: 1,
        automaticSelections: 1,
        requiredModels: { terra: 1, sol: 1 },
      },
    });
  });

  it("turns a provider timeout into a controlled escalation", async () => {
    const adapter = createOpenAiCompatibleProvider({
      apiKey: "test-only-key",
      baseUrl: "https://provider.invalid/v1",
      model: "cheap-model",
      inputEurPerMillionTokens: 0.1,
      outputEurPerMillionTokens: 0.4,
      timeoutMs: 1,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    });
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: adapter });

    await expect(engine.execute(cheapTask())).resolves.toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "provider_timeout",
    });
  });

  it("blocks calls that would exceed the shared monthly budget", async () => {
    const model = provider({ estimateMaximumCost: () => 12 });
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: model });
    const [first, second] = await Promise.all([
      engine.execute(cheapTask({ jobId: "first" })),
      engine.execute(cheapTask({ jobId: "second" })),
    ]);

    expect([first.route, second.route].sort()).toEqual(["cheap_model", "codex"]);
    expect(model.complete).toHaveBeenCalledTimes(1);
    expect([first.reason, second.reason]).toContain("monthly_budget_limit");
  });

  it("rejects a concurrent duplicate job id without corrupting reservations", async () => {
    let releaseProvider;
    const providerReleased = new Promise((resolve) => {
      releaseProvider = resolve;
    });
    const model = provider({
      complete: vi.fn(async () => {
        await providerReleased;
        return { confidence: 0.9, result: { ok: true }, costEur: 0.04 };
      }),
    });
    const engine = createRouterEngine({ stateStore: createMemoryStateStore(), provider: model });
    const first = engine.execute(cheapTask({ jobId: "same-job" }));
    const duplicate = await engine.execute(cheapTask({ jobId: "same-job" }));
    releaseProvider();

    await expect(first).resolves.toMatchObject({ status: "completed", route: "cheap_model" });
    expect(duplicate).toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "duplicate_job_id",
    });
    expect(model.complete).toHaveBeenCalledTimes(1);
    await expect(engine.metrics()).resolves.toMatchObject({ reservedEur: 0 });
  });

  it("fails closed when provider configuration is absent", async () => {
    const engine = createRouterEngine({ stateStore: createMemoryStateStore() });
    await expect(engine.execute(cheapTask())).resolves.toMatchObject({
      status: "escalate",
      route: "codex",
      reason: "provider_unavailable",
    });
  });
});

describe("KAN-127 provider and n8n contracts", () => {
  it("uses a replaceable OpenAI-compatible provider without exposing its key", async () => {
    const fetchImpl = vi.fn(async (_url, options) => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ confidence: 0.88, result: { label: "ok" } }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    }));
    const adapter = createOpenAiCompatibleProvider({
      apiKey: "test-only-key",
      baseUrl: "https://provider.invalid/v1",
      model: "cheap-model",
      inputEurPerMillionTokens: 0.1,
      outputEurPerMillionTokens: 0.4,
      fetchImpl,
    });
    const response = await adapter.complete(cheapTask());

    expect(response).toMatchObject({ confidence: 0.88, result: { label: "ok" }, costEur: 0.000018 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(adapter)).not.toContain("test-only-key");
  });

  it("keeps the router internal, authenticated, persistent, and capped at 20 EUR", () => {
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    const compose = fs.readFileSync(composePath, "utf8");
    const envTemplate = fs.readFileSync(envPath, "utf8");
    const request = workflow.nodes.find((node) => node.id === "kan127-router-request");

    expect(request.parameters.url).toBe("http://ai-router:3001/controlled-execute");
    expect(request.credentials).toEqual({ httpHeaderAuth: { name: "aiRouterInternalAuth" } });
    expect(compose).toContain("LLM_MONTHLY_BUDGET_EUR=20");
    expect(compose).toContain("router_data:/var/lib/ai-router");
    expect(compose).not.toContain('"3001:3001"');
    expect(envTemplate).not.toMatch(/LLM_API_KEY=\S+/);
    expect(JSON.stringify(workflow)).not.toContain("LLM_API_KEY");
    expect(JSON.stringify(workflow)).not.toContain("ROUTER_SHARED_SECRET");
    expect(JSON.stringify(workflow)).not.toContain("MODEL_SWITCH_REQUIRED");
    expect(JSON.stringify(workflow)).not.toContain("Jetzt brauchen wir");
  });

  it("authenticates the internal HTTP contract and returns normalized decisions", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "kan-127-"));
    const server = createRouterServer({
      env: {
        ROUTER_SHARED_SECRET: "test-only-secret",
        ROUTER_STATE_PATH: path.join(directory, "state.json"),
      },
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();

    try {
      expect((await fetch(`http://127.0.0.1:${port}/metrics`)).status).toBe(401);
      const response = await fetch(`http://127.0.0.1:${port}/controlled-execute`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-only-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          step: { complexity: "medium", componentCount: 2 },
          taskState: { jiraKey: "KAN-127", revision: 1 },
          task: {
            type: "summarization",
            complexity: "low",
            risk: "low",
            readOnly: true,
            contextComplete: true,
          },
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        mode: "automated_runtime",
        routingStatus: "ROUTE_SELECTED",
        requiredModel: "terra",
        status: "escalate",
        route: "codex",
        reason: "provider_unavailable",
      });
      expect(body).not.toHaveProperty("userMessage");
      expect(body).not.toHaveProperty("loopStatus", "ASK_USER");

      const securityResponse = await fetch(`http://127.0.0.1:${port}/controlled-execute`, {
        method: "POST",
        headers: {
          authorization: "Bearer test-only-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          step: { riskSignals: ["security"] },
          taskState: { jiraKey: "KAN-147", revision: 1 },
          task: {
            ...cheapTask({ jobId: "security-route" }),
            riskSignals: ["security"],
          },
        }),
      });
      const securityBody = await securityResponse.json();
      expect(securityBody).toMatchObject({
        mode: "automated_runtime",
        routingStatus: "ROUTE_SELECTED",
        requiredModel: "sol",
        status: "escalate",
        route: "codex",
      });
      expect(securityBody).not.toHaveProperty("userMessage");
      expect(securityBody).not.toHaveProperty("loopStatus", "ASK_USER");

      const metricsResponse = await fetch(`http://127.0.0.1:${port}/metrics`, {
        headers: { authorization: "Bearer test-only-secret" },
      });
      await expect(metricsResponse.json()).resolves.toMatchObject({
        modelRouting: {
          decisionsTotal: 2,
          continueCount: 0,
          switchRequiredCount: 0,
          automaticSelections: 2,
          currentModels: {},
          requiredModels: { terra: 1, sol: 1 },
          reasonCategories: {
            complexity_or_uncertainty: 1,
            security_or_data_risk: 1,
          },
        },
      });
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await rm(directory, { recursive: true, force: true });
    }
  });
});
