import { describe, expect, it, vi } from "vitest";
import {
  AUTOMATED_RUNTIME_ROUTING_STATES,
  createAutomatedRuntimeExecutor,
  createSafeTaskState,
  createTemporaryManualCodexExecutor,
  evaluateAutomatedRuntimeRoute,
  evaluateTemporaryManualCodexGate,
  LOOP_STATES,
  TEMPORARY_MANUAL_CODEX_ROUTING_STATES,
  normalizeModelLevel,
  requiredModelForStep,
  temporaryManualModelSwitchMessage,
} from "../../ops/n8n/model-router.mjs";

const taskState = {
  jiraKey: "KAN-127",
  status: "In Arbeit",
  completedSteps: ["scope"],
  currentStep: "implement",
  nextSteps: ["verify"],
  revision: 3,
};

function gate(currentModel, step = {}) {
  return evaluateTemporaryManualCodexGate({ currentModel, step, taskState });
}

describe("Temporary Manual Codex Routing", () => {
  it("allows Luna to continue for a bounded low-risk step", () => {
    expect(gate("luna", { complexity: "low", componentCount: 1 })).toMatchObject({
      status: "CONTINUE",
      currentModel: "luna",
      requiredModel: "luna",
    });
  });

  it("normalizes the full configured model identifier before the decision", () => {
    expect(normalizeModelLevel("gpt-5.6-luna")).toBe("luna");
    expect(gate("gpt-5.6-luna", { complexity: "low" })).toMatchObject({
      status: "CONTINUE",
      currentModel: "luna",
      requiredModel: "luna",
    });
  });

  it("rejects an unknown configured model instead of guessing", () => {
    expect(() => gate("unknown-model", { complexity: "low" })).toThrow(
      "unsupported current model",
    );
  });

  it("requires Terra before Luna executes a multi-component step", () => {
    expect(gate("luna", { complexity: "medium", componentCount: 2 })).toMatchObject({
      status: "MODEL_SWITCH_REQUIRED",
      requiredModel: "terra",
      reasonCategory: "complexity_or_uncertainty",
    });
  });

  it("requires Sol before Luna executes an architecture step", () => {
    expect(gate("luna", { architectureChange: true })).toMatchObject({
      status: "MODEL_SWITCH_REQUIRED",
      requiredModel: "sol",
      reasonCategory: "architecture_or_migration",
    });
  });

  it("allows Terra to continue for a Terra-level step", () => {
    expect(gate("terra", { debuggingComplexity: "medium" })).toMatchObject({
      status: "CONTINUE",
      requiredModel: "terra",
    });
  });

  it("requires Sol before Terra executes a critical step", () => {
    expect(gate("terra", { riskSignals: ["security"] })).toMatchObject({
      status: "MODEL_SWITCH_REQUIRED",
      requiredModel: "sol",
    });
  });

  it("does not escalate a merely complex step unnecessarily to Sol", () => {
    expect(requiredModelForStep({ complexity: "high", componentCount: 3 })).toEqual({
      requiredModel: "terra",
      reasonCategory: "complexity_or_uncertainty",
    });
  });

  it.each([
    "authentication",
    "authorization",
    "database_migration",
    "data_loss",
    "destructive_change",
    "permissions",
    "rls",
    "secret",
    "security",
    "session",
  ])("requires Sol for %s risk", (riskSignal) => {
    expect(requiredModelForStep({ riskSignals: [riskSignal] }).requiredModel).toBe("sol");
  });

  it("hard-stops Luna before a Terra-level step and emits the exact Terra line", async () => {
    const executeStep = vi.fn();
    const executor = createTemporaryManualCodexExecutor({ executeStep });
    const result = await executor({
      currentModel: "luna",
      step: { complexity: "medium" },
      taskState,
      task: { operation: "must-not-run" },
    });

    expect(result.status).toBe("MODEL_SWITCH_REQUIRED");
    expect(result.userMessage).toBe("Jetzt brauchen wir Terra.");
    expect(executeStep).not.toHaveBeenCalled();
  });

  it("hard-stops Terra before a security step and emits the exact Sol line", async () => {
    const executeStep = vi.fn();
    const executor = createTemporaryManualCodexExecutor({ executeStep });
    const result = await executor({
      currentModel: "terra",
      step: { riskSignals: ["security"] },
      taskState,
      task: { operation: "must-not-run" },
    });

    expect(result.status).toBe("MODEL_SWITCH_REQUIRED");
    expect(result.userMessage).toBe("Jetzt brauchen wir Sol.");
    expect(executeStep).not.toHaveBeenCalled();
    expect(temporaryManualModelSwitchMessage("sol")).toBe("Jetzt brauchen wir Sol.");
  });

  it("preserves the same safe task-state data for continuation", () => {
    const result = gate("luna", { architectureChange: true });
    expect(result.taskState).toEqual(taskState);
    expect(result.taskState).not.toBe(taskState);
  });

  it("keeps model routing separate from the defined loop states", () => {
    expect(TEMPORARY_MANUAL_CODEX_ROUTING_STATES).toEqual([
      "CONTINUE",
      "MODEL_SWITCH_REQUIRED",
    ]);
    expect(LOOP_STATES).toEqual(["PASS", "RETRY", "ASK_USER", "ABORT"]);
    expect([...TEMPORARY_MANUAL_CODEX_ROUTING_STATES, ...LOOP_STATES]).not.toContain(
      "ESCALATE",
    );
  });

  it("uses ASK_USER only for a human decision after the model gate passes", async () => {
    const executeStep = vi.fn();
    const executor = createTemporaryManualCodexExecutor({ executeStep });
    const humanDecision = await executor({
      currentModel: "luna",
      step: { complexity: "low", requiresHumanDecision: true },
      taskState,
    });
    const modelSwitch = await executor({
      currentModel: "luna",
      step: { architectureChange: true },
      taskState,
    });

    expect(humanDecision).toMatchObject({ status: "CONTINUE", loopStatus: "ASK_USER" });
    expect(modelSwitch).not.toHaveProperty("loopStatus", "ASK_USER");
    expect(executeStep).not.toHaveBeenCalled();
  });

  it("rejects secret-bearing task states before audit or execution", async () => {
    expect(() => createSafeTaskState({ ...taskState, apiToken: "must-not-appear" })).toThrow(
      "task_state_contains_secret_field",
    );
    const auditDecision = vi.fn();
    const executeStep = vi.fn();
    const executor = createTemporaryManualCodexExecutor({ executeStep, auditDecision });

    await expect(
      executor({
        currentModel: "luna",
        step: { complexity: "low" },
        taskState: { ...taskState, nested: { password: "must-not-appear" } },
      }),
    ).rejects.toThrow("task_state_contains_secret_field");
    expect(auditDecision).not.toHaveBeenCalled();
    expect(executeStep).not.toHaveBeenCalled();
  });

  it("audits only routing metadata and never task content", async () => {
    const auditDecision = vi.fn();
    const executor = createTemporaryManualCodexExecutor({
      executeStep: vi.fn(async () => ({ result: { ok: true } })),
      auditDecision,
    });
    await executor({
      currentModel: "luna",
      step: { complexity: "low" },
      taskState,
      task: { content: "private task content" },
    });

    expect(auditDecision).toHaveBeenCalledWith({
      mode: "temporary_manual_codex",
      status: "CONTINUE",
      currentModel: "luna",
      requiredModel: "luna",
      reasonCategory: "bounded_low_risk",
      jiraKey: "KAN-127",
      taskStateRevision: 3,
    });
    expect(JSON.stringify(auditDecision.mock.calls)).not.toContain("private task content");
  });
});

describe("Automated Runtime Routing", () => {
  it("selects Terra automatically without a user message or manual intervention", async () => {
    const executeStep = vi.fn(async (task) => ({
      status: "completed",
      route: "cheap_model",
      model: "test/cheap-model",
      confidence: 0.9,
      risk: "low",
      reason: "simple_model_task",
      result: { ok: true },
      estimated_cost: 0,
    }));
    const executor = createAutomatedRuntimeExecutor({ executeStep });

    const result = await executor({
      step: { complexity: "medium", componentCount: 2 },
      taskState,
      task: { type: "read_only_analysis" },
    });

    expect(result).toMatchObject({
      mode: "automated_runtime",
      routingStatus: "ROUTE_SELECTED",
      requiredModel: "terra",
      status: "completed",
      route: "cheap_model",
      model: "test/cheap-model",
    });
    expect(result).not.toHaveProperty("userMessage");
    expect(result).not.toHaveProperty("loopStatus", "ASK_USER");
    expect(executeStep).toHaveBeenCalledWith(
      expect.objectContaining({ requiredModel: "terra" }),
    );
  });

  it("selects the Sol/Codex route automatically without asking the user", async () => {
    const executeStep = vi.fn(async () => ({
      status: "escalate",
      route: "codex",
      model: null,
      confidence: 0,
      risk: "high",
      reason: "required_model_sol",
      result: {},
      estimated_cost: 0,
    }));
    const executor = createAutomatedRuntimeExecutor({ executeStep });
    const result = await executor({
      step: { riskSignals: ["security"] },
      taskState,
      task: { type: "read_only_analysis" },
    });

    expect(result).toMatchObject({
      requiredModel: "sol",
      status: "escalate",
      route: "codex",
    });
    expect(result).not.toHaveProperty("userMessage");
    expect(result).not.toHaveProperty("loopStatus", "ASK_USER");
    expect(executeStep).toHaveBeenCalledTimes(1);
  });

  it("uses ASK_USER only for an actual human decision", async () => {
    const executeStep = vi.fn();
    const executor = createAutomatedRuntimeExecutor({ executeStep });
    const result = await executor({
      step: { riskSignals: ["database_migration"], requiresHumanDecision: true },
      taskState,
    });

    expect(result).toMatchObject({
      requiredModel: "sol",
      loopStatus: "ASK_USER",
      reason: "human_decision_required",
    });
    expect(result).not.toHaveProperty("userMessage");
    expect(executeStep).not.toHaveBeenCalled();
  });

  it("rejects any runtime executor output that contains a manual switch message", async () => {
    const executor = createAutomatedRuntimeExecutor({
      executeStep: vi.fn(async () => ({
        result: { nested: { notice: "Jetzt brauchen wir Sol." } },
      })),
    });

    await expect(executor({ step: {}, taskState })).rejects.toThrow(
      "automated_runtime_must_not_emit_manual_switch_message",
    );
  });

  it("rejects a manual switch message embedded in surrounding provider text", async () => {
    const executor = createAutomatedRuntimeExecutor({
      executeStep: vi.fn(async () => ({
        result: { notice: "Hinweis: Jetzt brauchen wir Terra. Bitte manuell wechseln." },
      })),
    });

    await expect(executor({ step: {}, taskState })).rejects.toThrow(
      "automated_runtime_must_not_emit_manual_switch_message",
    );
  });

  it("rejects ASK_USER from an executor when no human decision was requested", async () => {
    const executor = createAutomatedRuntimeExecutor({
      executeStep: vi.fn(async () => ({ loopStatus: "ASK_USER" })),
    });

    await expect(executor({ step: {}, taskState })).rejects.toThrow(
      "automated_runtime_ask_user_requires_human_decision",
    );
  });

  it("keeps automated routing states distinct from manual and loop states", () => {
    expect(AUTOMATED_RUNTIME_ROUTING_STATES).toEqual(["ROUTE_SELECTED"]);
    expect(evaluateAutomatedRuntimeRoute({ step: {}, taskState })).toMatchObject({
      routingStatus: "ROUTE_SELECTED",
      requiredModel: "luna",
    });
    expect(TEMPORARY_MANUAL_CODEX_ROUTING_STATES).not.toContain("ROUTE_SELECTED");
    expect(LOOP_STATES).not.toContain("ROUTE_SELECTED");
  });
});
