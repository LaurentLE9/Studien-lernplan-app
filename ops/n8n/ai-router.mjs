import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MONTHLY_BUDGET_EUR = 20;
export const MIN_MODEL_CONFIDENCE = 0.75;

const DETERMINISTIC_TYPES = new Set([
  "ci_status_sync",
  "jira_key_extraction",
  "schema_validation",
  "status_mapping",
  "structured_metrics",
]);

const CHEAP_MODEL_TYPES = new Set([
  "classification",
  "structured_extraction",
  "summarization",
  "text_transformation",
  "read_only_analysis",
]);

const CRITICAL_SIGNALS = new Set([
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
]);

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function currentMonth(now) {
  return now.toISOString().slice(0, 7);
}

function initialState(month) {
  return {
    schemaVersion: 1,
    month,
    spentEur: 0,
    reservedEur: 0,
    reservations: {},
    metrics: {
      runsTotal: 0,
      routeCounts: { deterministic: 0, cheap_model: 0, codex: 0 },
      modelCalls: 0,
      avoidedCodexCalls: 0,
      escalations: 0,
      errors: 0,
      manualInterventions: 0,
      durationMsTotal: 0,
      models: {},
    },
  };
}

function normalizeState(state, month) {
  if (!state || state.month !== month) return initialState(month);
  return state;
}

export function createMemoryStateStore(seed) {
  let state = structuredClone(seed ?? null);
  return {
    async read() {
      return structuredClone(state);
    },
    async write(next) {
      state = structuredClone(next);
    },
  };
}

export function createFileStateStore(filePath) {
  return {
    async read() {
      try {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    },
    async write(next) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temporaryPath = `${filePath}.${process.pid}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await fs.rename(temporaryPath, filePath);
    },
  };
}

export function classifyTask(task = {}) {
  const signals = new Set((task.riskSignals ?? []).map((value) => String(value)));
  const risk = task.risk ?? (signals.size > 0 ? "high" : "low");

  if (task.contextComplete === false) {
    return { route: "codex", risk: "medium", reason: "missing_context" };
  }
  if (task.conflictingResults === true) {
    return { route: "codex", risk: "medium", reason: "conflicting_results" };
  }
  if ((task.failureCount ?? 0) >= 2) {
    return { route: "codex", risk: "medium", reason: "repeated_provider_failure" };
  }
  if (task.containsSensitiveData === true) {
    return { route: "codex", risk: "high", reason: "sensitive_data" };
  }
  if ([...signals].some((signal) => CRITICAL_SIGNALS.has(signal))) {
    return { route: "codex", risk: "high", reason: "critical_category" };
  }
  if (
    task.repositoryWrite === true ||
    task.multipleDependentFiles === true ||
    (task.dependentFileCount ?? 0) > 1
  ) {
    return { route: "codex", risk: "medium", reason: "repository_change" };
  }
  if (task.destructive === true || risk === "high") {
    return { route: "codex", risk: "high", reason: "high_risk" };
  }
  if (DETERMINISTIC_TYPES.has(task.type)) {
    return { route: "deterministic", risk: "low", reason: "deterministic_rule" };
  }
  if (
    CHEAP_MODEL_TYPES.has(task.type) &&
    task.complexity !== "high" &&
    task.readOnly !== false &&
    risk === "low"
  ) {
    return { route: "cheap_model", risk: "low", reason: "simple_model_task" };
  }
  return { route: "codex", risk: risk === "low" ? "medium" : risk, reason: "unsupported_or_complex" };
}

function publicMetrics(state, monthlyBudgetEur, warningRatio) {
  const metrics = state.metrics;
  const completedRuns = Math.max(metrics.runsTotal - metrics.errors, 0);
  return {
    month: state.month,
    monthlyBudgetEur,
    spentEur: roundMoney(state.spentEur),
    reservedEur: roundMoney(state.reservedEur),
    remainingEur: roundMoney(
      Math.max(monthlyBudgetEur - state.spentEur - state.reservedEur, 0),
    ),
    budgetWarning: state.spentEur + state.reservedEur >= monthlyBudgetEur * warningRatio,
    runsTotal: metrics.runsTotal,
    routeCounts: metrics.routeCounts,
    models: metrics.models,
    modelCalls: metrics.modelCalls,
    avoidedCodexCalls: metrics.avoidedCodexCalls,
    escalations: metrics.escalations,
    escalationRate: metrics.runsTotal ? metrics.escalations / metrics.runsTotal : 0,
    errors: metrics.errors,
    errorRate: metrics.runsTotal ? metrics.errors / metrics.runsTotal : 0,
    manualInterventions: metrics.manualInterventions,
    averageDurationMs: completedRuns
      ? Math.round(metrics.durationMsTotal / completedRuns)
      : 0,
  };
}

export function createRouterEngine({
  stateStore,
  provider,
  monthlyBudgetEur = MONTHLY_BUDGET_EUR,
  warningRatio = 0.8,
  minConfidence = MIN_MODEL_CONFIDENCE,
  now = () => new Date(),
} = {}) {
  if (!stateStore) throw new Error("stateStore is required");
  if (
    !Number.isFinite(monthlyBudgetEur) ||
    monthlyBudgetEur <= 0 ||
    monthlyBudgetEur > MONTHLY_BUDGET_EUR
  ) {
    throw new Error(`monthlyBudgetEur must be between 0 and ${MONTHLY_BUDGET_EUR}`);
  }
  if (!Number.isFinite(warningRatio) || warningRatio <= 0 || warningRatio > 1) {
    throw new Error("warningRatio must be between 0 and 1");
  }
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error("minConfidence must be between 0 and 1");
  }
  let transaction = Promise.resolve();

  async function updateState(mutator) {
    const operation = transaction.then(async () => {
      const month = currentMonth(now());
      const state = normalizeState(await stateStore.read(), month);
      const value = await mutator(state);
      await stateStore.write(state);
      return value;
    });
    transaction = operation.catch(() => {});
    return operation;
  }

  async function recordDecision(decision, durationMs = 0) {
    return updateState((state) => {
      state.metrics.runsTotal += 1;
      state.metrics.routeCounts[decision.route] += 1;
      if (decision.route !== "codex") state.metrics.avoidedCodexCalls += 1;
      if (decision.route === "codex") state.metrics.escalations += 1;
      state.metrics.durationMsTotal += durationMs;
    });
  }

  async function metrics() {
    return updateState((state) => publicMetrics(state, monthlyBudgetEur, warningRatio));
  }

  async function route(task) {
    const decision = classifyTask(task);
    return {
      status: decision.route === "codex" ? "escalate" : "completed",
      route: decision.route,
      model: decision.route === "cheap_model" ? provider?.model ?? null : null,
      confidence: decision.route === "deterministic" ? 1 : 0,
      risk: decision.risk,
      reason: decision.reason,
      result: {},
      estimated_cost: 0,
    };
  }

  async function execute(task = {}) {
    const startedAt = Date.now();
    const decision = classifyTask(task);

    if (decision.route === "deterministic") {
      await recordDecision(decision, Date.now() - startedAt);
      return {
        status: "completed",
        route: "deterministic",
        model: null,
        confidence: 1,
        risk: decision.risk,
        reason: decision.reason,
        result: { action: "delegate_to_deterministic_workflow" },
        estimated_cost: 0,
      };
    }

    if (decision.route === "codex") {
      await recordDecision(decision, Date.now() - startedAt);
      return {
        status: "escalate",
        route: "codex",
        model: null,
        confidence: 0,
        risk: decision.risk,
        reason: decision.reason,
        result: {},
        estimated_cost: 0,
      };
    }

    if (!provider) {
      await updateState((state) => {
        state.metrics.runsTotal += 1;
        state.metrics.routeCounts.cheap_model += 1;
        state.metrics.escalations += 1;
        state.metrics.errors += 1;
      });
      return {
        status: "escalate",
        route: "codex",
        model: null,
        confidence: 0,
        risk: "medium",
        reason: "provider_unavailable",
        result: {},
        estimated_cost: 0,
      };
    }

    const reservationId = String(task.jobId ?? randomUUID());
    const estimatedCost = roundMoney(provider.estimateMaximumCost(task));
    const reservation = await updateState((state) => {
      if (Object.hasOwn(state.reservations, reservationId)) {
        return { accepted: false, reason: "duplicate_job_id" };
      }
      const available = monthlyBudgetEur - state.spentEur - state.reservedEur;
      if (!Number.isFinite(estimatedCost) || estimatedCost <= 0 || estimatedCost > available) {
        return { accepted: false, reason: "monthly_budget_limit" };
      }
      state.reservations[reservationId] = estimatedCost;
      state.reservedEur = roundMoney(state.reservedEur + estimatedCost);
      return { accepted: true };
    });

    if (!reservation.accepted) {
      await recordDecision({ ...decision, route: "codex" }, Date.now() - startedAt);
      return {
        status: "escalate",
        route: "codex",
        model: null,
        confidence: 0,
        risk: "medium",
        reason: reservation.reason,
        result: {},
        estimated_cost: estimatedCost,
      };
    }

    try {
      const response = await provider.complete(task);
      const actualCost = roundMoney(response.costEur);
      if (!Number.isFinite(actualCost) || actualCost < 0 || actualCost > estimatedCost) {
        throw new Error("provider_cost_outside_reservation");
      }

      const lowConfidence = Number(response.confidence) < minConfidence;
      await updateState((state) => {
        const reservation = state.reservations[reservationId] ?? 0;
        delete state.reservations[reservationId];
        state.reservedEur = roundMoney(Math.max(state.reservedEur - reservation, 0));
        state.spentEur = roundMoney(state.spentEur + actualCost);
        state.metrics.runsTotal += 1;
        state.metrics.routeCounts.cheap_model += 1;
        state.metrics.modelCalls += 1;
        state.metrics.avoidedCodexCalls += lowConfidence ? 0 : 1;
        state.metrics.escalations += lowConfidence ? 1 : 0;
        state.metrics.durationMsTotal += Date.now() - startedAt;
        state.metrics.models[provider.model] = (state.metrics.models[provider.model] ?? 0) + 1;
      });

      if (lowConfidence) {
        return {
          status: "escalate",
          route: "codex",
          model: provider.model,
          confidence: Number(response.confidence) || 0,
          risk: "medium",
          reason: "low_confidence",
          result: {},
          estimated_cost: actualCost,
        };
      }

      return {
        status: "completed",
        route: "cheap_model",
        model: provider.model,
        confidence: Number(response.confidence),
        risk: decision.risk,
        reason: decision.reason,
        result: response.result ?? {},
        estimated_cost: actualCost,
      };
    } catch (error) {
      await updateState((state) => {
        const reservation = state.reservations[reservationId] ?? 0;
        delete state.reservations[reservationId];
        state.reservedEur = roundMoney(Math.max(state.reservedEur - reservation, 0));
        state.metrics.runsTotal += 1;
        state.metrics.routeCounts.cheap_model += 1;
        state.metrics.escalations += 1;
        state.metrics.errors += 1;
      });
      return {
        status: "escalate",
        route: "codex",
        model: provider.model,
        confidence: 0,
        risk: "medium",
        reason: error?.name === "AbortError" ? "provider_timeout" : "provider_failure",
        result: {},
        estimated_cost: 0,
      };
    }
  }

  return { execute, metrics, route };
}

export function createOpenAiCompatibleProvider({
  apiKey,
  baseUrl,
  model,
  inputEurPerMillionTokens,
  outputEurPerMillionTokens,
  maxOutputTokens = 512,
  timeoutMs = 15_000,
  fetchImpl = fetch,
}) {
  const inputRate = Number(inputEurPerMillionTokens);
  const outputRate = Number(outputEurPerMillionTokens);
  const outputLimit = Number(maxOutputTokens);
  const requestTimeout = Number(timeoutMs);
  if (!apiKey || !baseUrl || !model) throw new Error("provider configuration is incomplete");
  if (![inputRate, outputRate].every((rate) => Number.isFinite(rate) && rate >= 0)) {
    throw new Error("provider price configuration is invalid");
  }
  if (!Number.isInteger(outputLimit) || outputLimit <= 0 || outputLimit > 4096) {
    throw new Error("maxOutputTokens must be an integer between 1 and 4096");
  }
  if (!Number.isFinite(requestTimeout) || requestTimeout <= 0 || requestTimeout > 60_000) {
    throw new Error("timeoutMs must be between 1 and 60000");
  }

  function estimatedInputTokens(task) {
    return JSON.stringify({ instructions: task.instructions, content: task.content }).length;
  }

  return {
    model,
    estimateMaximumCost(task) {
      return (
        (estimatedInputTokens(task) * inputRate + outputLimit * outputRate) /
        1_000_000
      );
    },
    async complete(task) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeout);
      try {
        const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: outputLimit,
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  "Return JSON with keys confidence (0..1) and result. Do not propose actions outside the supplied read-only task.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  instructions: task.instructions ?? "",
                  content: task.content ?? "",
                }),
              },
            ],
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`provider_http_${response.status}`);
        const payload = await response.json();
        const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "{}");
        const usage = payload.usage ?? {};
        return {
          confidence: Number(parsed.confidence),
          result: parsed.result ?? {},
          costEur:
            ((Number(usage.prompt_tokens ?? 0) * inputRate +
              Number(usage.completion_tokens ?? 0) * outputRate) /
              1_000_000),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
