export const MODEL_LEVELS = Object.freeze(["luna", "terra", "sol"]);
export const TEMPORARY_MANUAL_CODEX_ROUTING_STATES = Object.freeze([
  "CONTINUE",
  "MODEL_SWITCH_REQUIRED",
]);
export const AUTOMATED_RUNTIME_ROUTING_STATES = Object.freeze(["ROUTE_SELECTED"]);
export const LOOP_STATES = Object.freeze(["PASS", "RETRY", "ASK_USER", "ABORT"]);

const CRITICAL_MODEL_SIGNALS = new Set([
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
]);

const TASK_STATE_FIELDS = [
  "jiraKey",
  "status",
  "completedSteps",
  "currentStep",
  "nextSteps",
  "risks",
  "blockers",
  "branch",
  "commits",
  "checks",
  "routers",
  "revision",
];

const SECRET_KEY = /(authorization|cookie|credential|password|secret|token|api.?key)/i;

function rank(model) {
  const value = MODEL_LEVELS.indexOf(normalizeModelLevel(model));
  if (value === -1) throw new Error(`unsupported current model: ${model}`);
  return value;
}

export function normalizeModelLevel(model) {
  const normalized = String(model ?? "").trim().toLowerCase();
  return MODEL_LEVELS.find(
    (level) => normalized === level || normalized.endsWith(`-${level}`),
  );
}

function assertNoSecretKeys(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) throw new Error("task_state_contains_secret_field");
    assertNoSecretKeys(child, seen);
  }
}

export function createSafeTaskState(input = {}) {
  assertNoSecretKeys(input);
  return Object.fromEntries(
    TASK_STATE_FIELDS
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, structuredClone(input[field])]),
  );
}

export function requiredModelForStep(step = {}) {
  const signals = new Set(
    (step.riskSignals ?? []).map((value) => String(value).trim().toLowerCase()),
  );
  if ([...signals].some((signal) => CRITICAL_MODEL_SIGNALS.has(signal))) {
    return { requiredModel: "sol", reasonCategory: "security_or_data_risk" };
  }
  if (
    step.architectureChange === true ||
    step.databaseMigration === true ||
    step.dataLossRisk === true
  ) {
    return { requiredModel: "sol", reasonCategory: "architecture_or_migration" };
  }
  if (
    step.conflictingResults === true ||
    ((step.previousFailedAttempts ?? 0) >= 2 && step.debuggingComplexity === "high")
  ) {
    return { requiredModel: "sol", reasonCategory: "repeated_or_conflicting_failure" };
  }
  if (
    step.complexity === "medium" ||
    step.complexity === "high" ||
    step.debuggingComplexity === "medium" ||
    step.debuggingComplexity === "high" ||
    (step.componentCount ?? 1) > 1 ||
    (step.dependencyCount ?? 0) > 2 ||
    (step.confidence ?? 1) < 0.8 ||
    (step.previousFailedAttempts ?? 0) > 0
  ) {
    return { requiredModel: "terra", reasonCategory: "complexity_or_uncertainty" };
  }
  return { requiredModel: "luna", reasonCategory: "bounded_low_risk" };
}

export function evaluateTemporaryManualCodexGate({ currentModel, step = {}, taskState = {} }) {
  const safeTaskState = createSafeTaskState(taskState);
  const requirement = requiredModelForStep(step);
  const currentModelLevel = normalizeModelLevel(currentModel);
  const status =
    rank(currentModelLevel) >= rank(requirement.requiredModel)
      ? "CONTINUE"
      : "MODEL_SWITCH_REQUIRED";
  return {
    status,
    currentModel: currentModelLevel,
    requiredModel: requirement.requiredModel,
    reasonCategory: requirement.reasonCategory,
    taskState: safeTaskState,
  };
}

export function temporaryManualModelSwitchMessage(requiredModel) {
  if (!MODEL_LEVELS.includes(requiredModel) || requiredModel === "luna") {
    throw new Error("a switch message requires Terra or Sol");
  }
  const displayName = requiredModel[0].toUpperCase() + requiredModel.slice(1);
  return `Jetzt brauchen wir ${displayName}.`;
}

export function createTemporaryManualCodexExecutor({
  executeStep,
  auditDecision = async () => {},
}) {
  if (typeof executeStep !== "function") throw new Error("executeStep is required");
  return async function executeModelGated(input) {
    const decision = evaluateTemporaryManualCodexGate(input);
    await auditDecision({
      mode: "temporary_manual_codex",
      status: decision.status,
      currentModel: decision.currentModel,
      requiredModel: decision.requiredModel,
      reasonCategory: decision.reasonCategory,
      jiraKey: decision.taskState.jiraKey ?? null,
      taskStateRevision: decision.taskState.revision ?? null,
    });

    if (decision.status === "MODEL_SWITCH_REQUIRED") {
      return {
        ...decision,
        userMessage: temporaryManualModelSwitchMessage(decision.requiredModel),
      };
    }

    if (input.step?.requiresHumanDecision === true) {
      return { ...decision, loopStatus: "ASK_USER" };
    }

    const execution = await executeStep(input.task ?? {});
    if (execution?.loopStatus && !LOOP_STATES.includes(execution.loopStatus)) {
      throw new Error(`unsupported loop state: ${execution.loopStatus}`);
    }
    return { ...decision, loopStatus: execution?.loopStatus ?? "PASS", execution };
  };
}

function assertNoManualRoutingOutput(value, seen = new Set()) {
  if (typeof value === "string") {
    if (/^Jetzt brauchen wir (Terra|Sol)\.$/.test(value)) {
      throw new Error("automated_runtime_must_not_emit_manual_switch_message");
    }
    return;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (key === "userMessage") {
      throw new Error("automated_runtime_must_not_emit_user_message");
    }
    assertNoManualRoutingOutput(child, seen);
  }
}

export function evaluateAutomatedRuntimeRoute({ step = {}, taskState = {} }) {
  const safeTaskState = createSafeTaskState(taskState);
  const requirement = requiredModelForStep(step);
  return {
    mode: "automated_runtime",
    routingStatus: "ROUTE_SELECTED",
    requiredModel: requirement.requiredModel,
    reasonCategory: requirement.reasonCategory,
    taskState: safeTaskState,
  };
}

export function createAutomatedRuntimeExecutor({
  executeStep,
  auditDecision = async () => {},
}) {
  if (typeof executeStep !== "function") throw new Error("executeStep is required");
  return async function executeAutomatedRuntime(input) {
    const decision = evaluateAutomatedRuntimeRoute(input);
    await auditDecision({
      mode: decision.mode,
      status: decision.routingStatus,
      currentModel: null,
      requiredModel: decision.requiredModel,
      reasonCategory: decision.reasonCategory,
      jiraKey: decision.taskState.jiraKey ?? null,
      taskStateRevision: decision.taskState.revision ?? null,
    });

    if (input.step?.requiresHumanDecision === true) {
      return {
        status: "escalate",
        route: "codex",
        model: null,
        confidence: 0,
        risk: "high",
        reason: "human_decision_required",
        result: {},
        estimated_cost: 0,
        loopStatus: "ASK_USER",
        ...decision,
      };
    }

    const execution = await executeStep({
      ...(input.task ?? {}),
      requiredModel: decision.requiredModel,
    });
    assertNoManualRoutingOutput(execution);
    if (execution?.loopStatus && !LOOP_STATES.includes(execution.loopStatus)) {
      throw new Error(`unsupported loop state: ${execution.loopStatus}`);
    }
    if (execution?.loopStatus === "ASK_USER") {
      throw new Error("automated_runtime_ask_user_requires_human_decision");
    }
    return {
      ...execution,
      ...decision,
      loopStatus: execution?.loopStatus ?? "PASS",
    };
  };
}
