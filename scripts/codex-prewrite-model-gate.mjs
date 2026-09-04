const LEVELS = ["luna", "terra", "sol"];

function normalizeLevel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const match = LEVELS.find((level) => normalized === level || normalized.endsWith(`-${level}`));
  if (!match) throw new Error(`unsupported model level: ${value}`);
  return match;
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
    current: null,
    files: null,
    complexity: null,
    dependencies: 0,
    failedAttempts: 0,
    integration: false,
    refactor: false,
    uncertainty: false,
    strongCoupling: false,
    difficultBug: false,
    terraInsufficient: false,
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
    if (arg === "--current") result.current = argv[++index];
    else if (arg === "--files") result.files = parseIntegerFlag(argv[++index], "--files");
    else if (arg === "--complexity") result.complexity = String(argv[++index] ?? "").toLowerCase();
    else if (arg === "--dependencies") result.dependencies = parseIntegerFlag(argv[++index], "--dependencies");
    else if (arg === "--failed-attempts") result.failedAttempts = parseIntegerFlag(argv[++index], "--failed-attempts");
    else if (arg === "--integration") result.integration = true;
    else if (arg === "--refactor") result.refactor = true;
    else if (arg === "--uncertainty") result.uncertainty = true;
    else if (arg === "--strong-coupling") result.strongCoupling = true;
    else if (arg === "--difficult-bug") result.difficultBug = true;
    else if (arg === "--terra-insufficient") result.terraInsufficient = true;
    else if (arg === "--architecture") result.architecture = true;
    else if (arg === "--security") result.security = true;
    else if (arg === "--auth") result.auth = true;
    else if (arg === "--rls") result.rls = true;
    else if (arg === "--secrets") result.secrets = true;
    else if (arg === "--migration") result.migration = true;
    else if (arg === "--data-loss") result.dataLoss = true;
    else throw new Error(`unknown argument: ${arg}`);
  }

  if (!result.current) throw new Error("--current is required");
  if (result.files === null) throw new Error("--files is required");
  if (result.complexity === null) throw new Error("--complexity is required");
  if (!["low", "medium", "high"].includes(result.complexity)) {
    throw new Error("--complexity must be low, medium or high");
  }
  return result;
}

export function requiredModelForDirectCodexBlock(input) {
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
    input.terraInsufficient ||
    failedAttempts >= 2 ||
    (input.refactor && input.complexity === "high") ||
    (files >= 8 && input.complexity === "high") ||
    (dependencies >= 6 && input.complexity === "high")
  ) {
    return "sol";
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
    return "terra";
  }

  return "luna";
}

export function evaluateDirectCodexPreWriteGate(input) {
  const current = normalizeLevel(input.current);
  const required = requiredModelForDirectCodexBlock(input);
  const allowed = LEVELS.indexOf(current) >= LEVELS.indexOf(required);
  return {
    status: allowed ? "CONTINUE" : "MODEL_SWITCH_REQUIRED",
    currentModel: current,
    requiredModel: required,
  };
}

export function directCodexSwitchMessage(requiredModel) {
  const required = normalizeLevel(requiredModel);
  if (required === "luna") throw new Error("no manual switch message for Luna");
  return `Jetzt brauchen wir ${required[0].toUpperCase()}${required.slice(1)}.`;
}

export function runCli(argv = process.argv.slice(2)) {
  const input = parseArgs(argv);
  const decision = evaluateDirectCodexPreWriteGate(input);
  if (decision.status === "MODEL_SWITCH_REQUIRED") {
    process.stdout.write(`${directCodexSwitchMessage(decision.requiredModel)}\n`);
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
