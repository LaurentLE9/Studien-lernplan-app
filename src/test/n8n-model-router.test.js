import { describe, expect, it, vi } from "vitest";
import {
  createModelGatedExecutor,
  createSafeTaskState,
  evaluateModelGate,
  LOOP_STATES,
  MODEL_ROUTING_STATES,
  modelSwitchMessage,
  normalizeModelLevel,
  requiredModelForStep,
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
  return evaluateModelGate({ currentModel, step, taskState });
}

describe("KAN-127 technical model gate", () => {
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

  it("hard-stops before executing the next step and emits the exact Sol line", async () => {
    const executeStep = vi.fn();
    const executor = createModelGatedExecutor({ executeStep });
    const result = await executor({
      currentModel: "luna",
      step: { riskSignals: ["rls"] },
      taskState,
      task: { operation: "must-not-run" },
    });

    expect(result.status).toBe("MODEL_SWITCH_REQUIRED");
    expect(result.userMessage).toBe("Jetzt brauchen wir Sol.");
    expect(executeStep).not.toHaveBeenCalled();
  });

  it("emits the exact Terra switch line", () => {
    expect(modelSwitchMessage("terra")).toBe("Jetzt brauchen wir Terra.");
  });

  it("preserves the same safe task-state data for continuation", () => {
    const result = gate("luna", { architectureChange: true });
    expect(result.taskState).toEqual(taskState);
    expect(result.taskState).not.toBe(taskState);
  });

  it("keeps model routing separate from the defined loop states", () => {
    expect(MODEL_ROUTING_STATES).toEqual(["CONTINUE", "MODEL_SWITCH_REQUIRED"]);
    expect(LOOP_STATES).toEqual(["PASS", "RETRY", "ASK_USER", "ABORT"]);
    expect([...MODEL_ROUTING_STATES, ...LOOP_STATES]).not.toContain("ESCALATE");
  });

  it("uses ASK_USER only for a human decision after the model gate passes", async () => {
    const executeStep = vi.fn();
    const executor = createModelGatedExecutor({ executeStep });
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
    const executor = createModelGatedExecutor({ executeStep, auditDecision });

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
    const executor = createModelGatedExecutor({
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
