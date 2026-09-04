import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WEBHOOK_PATH = "/webhook/github-ci-to-jira";
export const MAX_BODY_BYTES = 1024 * 1024;

export function normalizeSingleHeader(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value.length === 1 && typeof value[0] === "string" && value[0].length > 0) {
    return value[0];
  }
  return null;
}

export function hasValidSignature(rawBody, signatureHeader, secret) {
  const signature = normalizeSingleHeader(signatureHeader);
  if (!secret || !signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function isCompletedWorkflowRun(headers, payload) {
  return (
    normalizeSingleHeader(headers["x-github-event"]) === "workflow_run" &&
    payload?.action === "completed"
  );
}

export function isTrustedWorkflowRun(payload, expectedRepository) {
  return (
    typeof expectedRepository === "string" &&
    expectedRepository.length > 0 &&
    payload?.repository?.full_name === expectedRepository &&
    payload?.workflow_run?.head_repository?.full_name === expectedRepository
  );
}

function deliveryFilePath(directory, deliveryId) {
  const digest = createHash("sha256").update(deliveryId).digest("hex");
  return path.join(directory, `${digest}.json`);
}

export function createFileDeliveryStore(directory) {
  if (!directory) throw new Error("DELIVERY_STORE_DIR is required");

  return {
    async reserve(deliveryId) {
      await mkdir(directory, { recursive: true });
      const filePath = deliveryFilePath(directory, deliveryId);
      try {
        const handle = await open(filePath, "wx");
        try {
          await handle.writeFile(JSON.stringify({ deliveryId, state: "pending" }));
        } finally {
          await handle.close();
        }
        return true;
      } catch (error) {
        if (error?.code === "EEXIST") return false;
        throw error;
      }
    },
    async complete(deliveryId) {
      const filePath = deliveryFilePath(directory, deliveryId);
      const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify({ deliveryId, state: "succeeded" }), {
        flag: "wx",
      });
      await rename(temporaryPath, filePath);
    },
    async release(deliveryId) {
      await rm(deliveryFilePath(directory, deliveryId), { force: true });
    },
  };
}

function respond(response, statusCode, body) {
  if (response.writableEnded) return;
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createWebhookVerifier({
  secret,
  targetUrl,
  expectedRepository,
  deliveryStore,
  fetchImpl = fetch,
}) {
  if (!secret) throw new Error("GITHUB_WEBHOOK_SECRET is required");
  if (!targetUrl) throw new Error("N8N_WEBHOOK_URL is required");
  if (!expectedRepository) throw new Error("GITHUB_EXPECTED_REPOSITORY is required");
  if (!deliveryStore) throw new Error("deliveryStore is required");

  return createServer((request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url ?? "", "http://webhook-verifier.local").pathname;
    } catch {
      respond(response, 400, { accepted: false });
      return;
    }

    if (request.method !== "POST" || pathname !== WEBHOOK_PATH) {
      respond(response, 404, { accepted: false });
      return;
    }

    const chunks = [];
    let byteCount = 0;
    let oversized = false;

    request.on("data", (chunk) => {
      if (oversized) return;
      byteCount += chunk.length;
      if (byteCount > MAX_BODY_BYTES) {
        oversized = true;
        chunks.length = 0;
        respond(response, 413, { accepted: false, error: "payload_too_large" });
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", async () => {
      if (oversized) return;

      const rawBody = Buffer.concat(chunks);
      const signature = request.headers["x-hub-signature-256"];

      if (!hasValidSignature(rawBody, signature, secret)) {
        respond(response, 401, { accepted: false });
        return;
      }

      let payload;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        respond(response, 400, { accepted: false });
        return;
      }

      if (!isCompletedWorkflowRun(request.headers, payload)) {
        respond(response, 202, { accepted: true, forwarded: false });
        return;
      }

      if (!isTrustedWorkflowRun(payload, expectedRepository)) {
        respond(response, 403, { accepted: false, forwarded: false });
        return;
      }

      const deliveryId = normalizeSingleHeader(request.headers["x-github-delivery"]);
      if (!deliveryId) {
        respond(response, 400, { accepted: false, forwarded: false });
        return;
      }

      let reserved = false;
      try {
        reserved = await deliveryStore.reserve(deliveryId);
        if (!reserved) {
          respond(response, 202, { accepted: true, forwarded: false, duplicate: true });
          return;
        }

        const upstream = await fetchImpl(targetUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-github-delivery": deliveryId,
          },
          body: rawBody,
        });

        if (!upstream.ok) {
          await deliveryStore.release(deliveryId);
          respond(response, 502, { accepted: false });
          return;
        }

        await deliveryStore.complete(deliveryId);
        respond(response, 202, { accepted: true, forwarded: true });
      } catch {
        if (reserved) await deliveryStore.release(deliveryId).catch(() => {});
        respond(response, 502, { accepted: false });
      }
    });

    request.on("error", () => {
      if (!response.headersSent) respond(response, 400, { accepted: false });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createWebhookVerifier({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    targetUrl: process.env.N8N_WEBHOOK_URL,
    expectedRepository: process.env.GITHUB_EXPECTED_REPOSITORY,
    deliveryStore: createFileDeliveryStore(process.env.DELIVERY_STORE_DIR),
  });
  server.listen(3000, "0.0.0.0");
}
