import { readFileSync } from "node:fs";

const CAPABILITIES = ["low", "medium", "high"];
const LEGACY_MODEL_TO_CAPABILITY = {
  luna: "low",
  terra: "medium",
  sol: "high",
};
const CAPABILITY_TO_LEGACY_MODEL = {
  low: "luna",
  medium: "terra",
  high: "sol",
};

const mappingUrl = new URL("../config/manual-model-routing.json", import.meta.url);
export const MANUAL_MODEL_ROUTING_CONFIG = JSON.parse(readFileSync(mappingUrl, "utf8"));

export function normalizeCapability(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (CAPABILITIES.includes(normalized)) return normalized;

  for (const [legacyModel, capability] of Object.entries(LEGACY_MODEL_TO_CAPABILITY)) {
    if (normalized === legacyModel || normalized.endsWith(`-${legacyModel}`)) return capability;
  }

  throw new Error(`unsupported capability: ${value}`);
}

function normalizeActiveCapability(value) {
  const normalized = String(value ?? "unknown").trim().toLowerCase();
  if (!normalized || normalized === "unknown") return "unknown";
  return normalizeCapability(normalized);
}

export function normalizeProvider(value, config = MANUAL_MODEL_ROUTING_CONFIG) {
  const normalized = String(value ?? "unknown").trim().toLowerCase();
  if (!normalized || normalized === "unknown") return "unknown";
  if (config.providers?.[normalized]) return normalized;

  for (const [provider, definition] of Object.entries(config.providers ?? {})) {
    const aliases = (definition.aliases ?? []).map((alias) => String(alias).trim().toLowerCase());
    if (aliases.includes(normalized)) return provider;
  }

  return normalized;
}

function normalizeModelSpec(entry) {
  if (typeof entry === "string" && entry.trim()) {
    return { id: entry.trim(), label: entry.trim(), aliases: [] };
  }
  if (!entry || typeof entry !== "object") return null;

  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : null;
  const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : id;
  const aliases = Array.isArray(entry.aliases)
    ? entry.aliases.filter((alias) => typeof alias === "string" && alias.trim()).map((alias) => alias.trim())
    : [];

  if (!id && !label) return null;
  return { id: id ?? label, label: label ?? id, aliases };
}

export function providerModelSpecForCapability(provider, capability, config = MANUAL_MODEL_ROUTING_CONFIG) {
  const normalizedProvider = normalizeProvider(provider, config);
  const normalizedCapability = normalizeCapability(capability);
  return normalizeModelSpec(config.providers?.[normalizedProvider]?.models?.[normalizedCapability]);
}

export function providerModelForCapability(provider, capability, config = MANUAL_MODEL_ROUTING_CONFIG) {
  return providerModelSpecForCapability(provider, capability, config)?.label ?? null;
}

function canonicalModelName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function capabilityForProviderModel(provider, model, config = MANUAL_MODEL_ROUTING_CONFIG) {
  const normalizedModel = String(model ?? "").trim();
  if (!normalizedModel || normalizedModel.toLowerCase() === "unknown") return "unknown";

  try {
    return normalizeCapability(normalizedModel);
  } catch {
    // Provider-specific model names are resolved from the central mapping below.
  }

  const normalizedProvider = normalizeProvider(provider, config);
  const providers =
    normalizedProvider === "unknown"
      ? Object.entries(config.providers ?? {})
      : [[normalizedProvider, config.providers?.[normalizedProvider]]];

  const inputCanonical = canonicalModelName(normalizedModel);
  const matches = [];

  for (const [, definition] of providers) {
    if (!definition) continue;
    for (const capability of CAPABILITIES) {
      const spec = normalizeModelSpec(definition.models?.[capability]);
      if (!spec) continue;
      const knownNames = [spec.id, spec.label, ...spec.aliases];
      if (knownNames.some((name) => canonicalModelName(name) === inputCanonical)) {
        matches.push(capability);
      }
    }
  }

  const uniqueMatches = [...new Set(matches)];
  return uniqueMatches.length === 1 ? uniqueMatches[0] : "unknown";
}

function parseIntegerFlag(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function parseArgs(argv) {
  const result = {
    provider: "unknown",
    activeCapability: "unknown",
    activeModel: "unknown",
    legacyActive: null,
    files: null,
    complexity: null,
    dependencies: 0,
    failedAttempts: 0,
    integration: false,
    refactor: false,
    uncertainty: false,
    strongCoupling: false,
    difficultBug: false,
    mediumInsufficient: false,
    architecture: false,
    security: false,
    auth: false,
    rls: false,
    secrets: false,
    migration: false,
    dataLoss: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--provider" || arg === "--active-provider") result.provider = argv[++index];
    else if (arg === "--active-capability") result.activeCapability = argv[++index];
    else if (arg === "--active-model") result.activeModel = argv[++index];
    else if (arg === "--active" || arg === "--current") result.legacyActive = argv[++index];
    else if (arg === "--files") result.files = parseIntegerFlag(argv[++index], "--files");
    else if (arg === "--complexity") result.complexity = String(argv[++index] ?? "").toLowerCase();
    else if (arg === "--dependencies") result.dependencies = parseIntegerFlag(argv[++index], "--dependencies");
    else if (arg === "--failed-attempts") result.failedAttempts = parseIntegerFlag(argv[++index], "--failed-attempts");
    else if (arg === "--integration") result.integration = true;
    else if (arg === "--refactor") result.refactor = true;
    else if (arg === "--uncertainty") result.uncertainty = true;
    else if (arg === "--strong-coupling") result.strongCoupling = true;
    else if (arg === "--difficult-bug") result.difficultBug = true;
    else if (arg === "--medium-insufficient" || arg === "--terra-insufficient") result.mediumInsufficient = true;
    else if (arg === "--architecture") result.architecture = true;
    else if (arg === "--security") result.security = true;
    else if (arg === "--auth") result.auth = true;
    else if (arg === "--rls") result.rls = true;
    else if (arg === "--secrets") result.secrets = true;
    else if (arg === "--migration") result.migration = true;
    else if (arg === "--data-loss") result.dataLoss = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (result.files === null) throw new Error("--files is required");
  if (result.complexity === null) throw new Error("--complexity is required");
  if (!["low", "medium", "high"].includes(result.complexity)) {
    throw new Error("--complexity must be low, medium or high");
  }

  result.provider = normalizeProvider(result.provider);

  if (result.legacyActive !== null && result.activeCapability === "unknown") {
    try {
      result.activeCapability = normalizeActiveCapability(result.legacyActive);
      if (
        result.provider === "unknown" &&
        ["luna", "terra", "sol"].includes(String(result.legacyActive).toLowerCase())
      ) {
        result.provider = "openai";
      }
    } catch {
      if (result.activeModel === "unknown") result.activeModel = result.legacyActive;
    }
  }

  result.activeCapability = normalizeActiveCapability(result.activeCapability);
  if (result.activeCapability === "unknown" && result.activeModel !== "unknown") {
    result.activeCapability = capabilityForProviderModel(result.provider, result.activeModel);
  }

  return result;
}

export function requiredCapabilityForManualBlock(input) {
  const files = Number.isInteger(input.files) ? input.files : 0;
  const dependencies = Number.isInteger(input.dependencies) ? input.dependencies : 0;
  const failedAttempts = Number.isInteger(input.failedAttempts) ? input.failedAttempts : 0;

  if (
    input.architecture ||
    input.security ||
    input.auth ||
    input.rls ||
    input.secrets ||
    input.migration ||
    input.dataLoss ||
    input.strongCoupling ||
    input.difficultBug ||
    input.mediumInsufficient ||
    input.terraInsufficient ||
    failedAttempts >= 2 ||
    (input.refactor && input.complexity === "high") ||
    (files >= 8 && input.complexity === "high") ||
    (dependencies >= 6 && input.complexity === "high")
  ) {
    return "high";
  }

  if (
    input.integration ||
    input.refactor ||
    input.uncertainty ||
    files > 1 ||
    dependencies > 2 ||
    failedAttempts > 0 ||
    input.complexity === "medium" ||
    input.complexity === "high"
  ) {
    return "medium";
  }

  return "low";
}

export function evaluateManualPreWriteGate(input) {
  const requiredCapability = requiredCapabilityForManualBlock(input);
  const provider = normalizeProvider(input.provider ?? input.activeProvider);
  const activeModel = String(input.activeModel ?? "unknown").trim() || "unknown";

  let activeCapability = normalizeActiveCapability(
    input.activeCapability ?? input.active ?? input.current ?? "unknown",
  );
  if (activeCapability === "unknown" && activeModel !== "unknown") {
    activeCapability = capabilityForProviderModel(provider, activeModel);
  }

  const targetModelSpec = providerModelSpecForCapability(provider, requiredCapability);

  if (activeCapability === "unknown") {
    return {
      status: requiredCapability === "low" ? "CONTINUE" : "ACTIVE_CAPABILITY_UNKNOWN",
      provider,
      activeProvider: provider,
      activeModel,
      activeCapability: "unknown",
      requiredCapability,
      targetModel: targetModelSpec?.label ?? null,
      targetModelId: targetModelSpec?.id ?? null,
    };
  }

  const allowed = CAPABILITIES.indexOf(activeCapability) >= CAPABILITIES.indexOf(requiredCapability);
  return {
    status: allowed ? "CONTINUE" : "MODEL_SWITCH_REQUIRED",
    provider,
    activeProvider: provider,
    activeModel,
    activeCapability,
    requiredCapability,
    targetModel: targetModelSpec?.label ?? null,
    targetModelId: targetModelSpec?.id ?? null,
  };
}

export function manualSwitchMessage(requiredCapability, provider = "unknown") {
  const required = normalizeCapability(requiredCapability);
  if (required === "low") throw new Error("no manual switch message for low capability");

  const targetModel = providerModelForCapability(provider, required);
  if (targetModel) return `Jetzt brauchen wir ${targetModel}.`;
  return `Jetzt brauchen wir ein Modell der Stufe ${required.toUpperCase()}.`;
}

// Compatibility exports for existing Codex/OpenAI callers. New code should use the neutral exports above.
export function requiredModelForDirectCodexBlock(input) {
  return CAPABILITY_TO_LEGACY_MODEL[requiredCapabilityForManualBlock(input)];
}

export function evaluateDirectCodexPreWriteGate(input) {
  const decision = evaluateManualPreWriteGate({
    ...input,
    provider: input.provider ?? "openai",
    activeCapability: input.activeCapability ?? input.active ?? input.current ?? "unknown",
  });

  return {
    ...decision,
    requiredModel: CAPABILITY_TO_LEGACY_MODEL[decision.requiredCapability],
    currentModel:
      decision.activeCapability === "unknown"
        ? "unknown"
        : CAPABILITY_TO_LEGACY_MODEL[decision.activeCapability],
  };
}

export function directCodexSwitchMessage(requiredModel) {
  const requiredCapability = normalizeCapability(requiredModel);
  return manualSwitchMessage(requiredCapability, "openai");
}

export function runCli(argv = process.argv.slice(2)) {
  const input = parseArgs(argv);
  const decision = evaluateManualPreWriteGate(input);

  if (decision.status === "MODEL_SWITCH_REQUIRED" || decision.status === "ACTIVE_CAPABILITY_UNKNOWN") {
    process.stdout.write(`${manualSwitchMessage(decision.requiredCapability, decision.provider)}\n`);
    return 42;
  }

  process.stdout.write("CONTINUE\n");
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
