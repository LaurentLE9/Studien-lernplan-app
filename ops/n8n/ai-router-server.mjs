import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFileStateStore,
  createOpenAiCompatibleProvider,
  createRouterEngine,
  MONTHLY_BUDGET_EUR,
} from "./ai-router.mjs";

export const MAX_REQUEST_BYTES = 64 * 1024;

function configuredProvider(env, fetchImpl) {
  const keys = [
    "LLM_API_KEY",
    "LLM_BASE_URL",
    "LLM_MODEL",
    "LLM_INPUT_EUR_PER_MILLION_TOKENS",
    "LLM_OUTPUT_EUR_PER_MILLION_TOKENS",
  ];
  if (!keys.every((key) => env[key])) return null;
  return createOpenAiCompatibleProvider({
    apiKey: env.LLM_API_KEY,
    baseUrl: env.LLM_BASE_URL,
    model: env.LLM_MODEL,
    inputEurPerMillionTokens: env.LLM_INPUT_EUR_PER_MILLION_TOKENS,
    outputEurPerMillionTokens: env.LLM_OUTPUT_EUR_PER_MILLION_TOKENS,
    maxOutputTokens: Number(env.LLM_MAX_OUTPUT_TOKENS ?? 512),
    timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 15_000),
    fetchImpl,
  });
}

function json(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BYTES) {
      const error = new Error("payload_too_large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.statusCode = 400;
    throw error;
  }
}

export function createRouterServer({ env = process.env, fetchImpl = fetch } = {}) {
  const statePath = env.ROUTER_STATE_PATH ?? path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "data",
    "router-state.json",
  );
  const engine = createRouterEngine({
    stateStore: createFileStateStore(statePath),
    provider: configuredProvider(env, fetchImpl),
    monthlyBudgetEur: Number(env.LLM_MONTHLY_BUDGET_EUR ?? MONTHLY_BUDGET_EUR),
    warningRatio: Number(env.LLM_BUDGET_WARNING_RATIO ?? 0.8),
  });
  const expectedToken = env.ROUTER_SHARED_SECRET;
  if (!expectedToken) throw new Error("ROUTER_SHARED_SECRET is required");

  return http.createServer(async (request, response) => {
    if (request.url === "/health" && request.method === "GET") {
      return json(response, 200, { status: "ok" });
    }
    if (request.headers.authorization !== `Bearer ${expectedToken}`) {
      return json(response, 401, { status: "failed", reason: "unauthorized" });
    }
    try {
      if (request.url === "/metrics" && request.method === "GET") {
        return json(response, 200, await engine.metrics());
      }
      if (request.url === "/route" && request.method === "POST") {
        return json(response, 200, await engine.route(await readJson(request)));
      }
      if (request.url === "/execute" && request.method === "POST") {
        return json(response, 200, await engine.execute(await readJson(request)));
      }
      return json(response, 404, { status: "failed", reason: "not_found" });
    } catch (error) {
      return json(response, error.statusCode ?? 500, {
        status: "failed",
        reason: error.message === "payload_too_large" ? "payload_too_large" : "invalid_request",
      });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createRouterServer();
  server.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}
