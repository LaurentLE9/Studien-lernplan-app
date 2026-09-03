import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const WEBHOOK_PATH = "/webhook/github-ci-to-jira";
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_SEEN_DELIVERIES = 1000;
const seenDeliveries = new Set();

export function hasValidSignature(rawBody, signature, secret) {
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
  return headers["x-github-event"] === "workflow_run" && payload?.action === "completed";
}

function respond(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function rememberDelivery(deliveryId) {
  if (seenDeliveries.size >= MAX_SEEN_DELIVERIES) {
    seenDeliveries.delete(seenDeliveries.values().next().value);
  }
  seenDeliveries.add(deliveryId);
}

export function createWebhookVerifier({ secret, targetUrl, fetchImpl = fetch }) {
  if (!secret) throw new Error("GITHUB_WEBHOOK_SECRET is required");
  if (!targetUrl) throw new Error("N8N_WEBHOOK_URL is required");

  return createServer((request, response) => {
    if (request.method !== "POST" || request.url !== WEBHOOK_PATH) {
      respond(response, 404, { accepted: false });
      return;
    }

    const chunks = [];
    let byteCount = 0;

    request.on("data", (chunk) => {
      byteCount += chunk.length;
      if (byteCount > MAX_BODY_BYTES) request.destroy();
      else chunks.push(chunk);
    });

    request.on("end", async () => {
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

      const deliveryId = request.headers["x-github-delivery"];
      if (deliveryId && seenDeliveries.has(deliveryId)) {
        respond(response, 202, { accepted: true, forwarded: false, duplicate: true });
        return;
      }

      try {
        const upstream = await fetchImpl(targetUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(deliveryId ? { "x-github-delivery": deliveryId } : {}),
          },
          body: rawBody,
        });

        if (!upstream.ok) {
          respond(response, 502, { accepted: false });
          return;
        }

        if (deliveryId) rememberDelivery(deliveryId);
        respond(response, 202, { accepted: true, forwarded: true });
      } catch {
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
  });
  server.listen(3000, "0.0.0.0");
}
