const LEVELS = ["luna", "terra", "sol"];

function normalizeLevel(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const match = LEVELS.find((level) => normalized === level || normalized.endsWith(`-${level}`));
  if (!match) throw new Error(`unsupported model level: ${value}`);
  return match;
}

function parseArgs(argv) {
  const result = {
    current: null,
    files: 1,
    complexity: "low",
    integration: false,
    refactor: false,
    uncertainty: false,
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
    else if (arg === "--files") result.files = Number(argv[++index]);
    else if (arg === "--complexity") result.complexity = String(argv[++index] ?? "").toLowerCase();
    else if (arg === "--integration") result.integration = true;
    else if (arg === "--refactor") result.refactor = true;
    else if (arg === "--uncertainty") result.uncertainty = true;
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
  if (!Number.isInteger(result.files) || result.files < 0) throw new Error("--files must be a non-negative integer");
  if (!["low", "medium", "high"].includes(result.complexity)) throw new Error("--complexity must be low, medium or high");
  return result;
}

export function requiredModelForDirectCodexBlock(input) {
  if (
    input.architecture ||
    input.security ||
    input.auth ||
    input.rls ||
    input.secrets ||
    input.migration ||
    input.dataLoss
  ) {
    return "sol";
  }

  if (
    input.integration ||
    input.refactor ||
    input.uncertainty ||
    input.files > 1 ||
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
