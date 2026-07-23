const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL;

export class SupabaseRequestError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export function getSupabaseAnonKey() {
  return SUPABASE_ANON_KEY;
}

export function getAuthRedirectUrl() {
  const configured = String(PUBLIC_APP_URL || "").trim();
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return undefined;
}

export function hasSupabaseConfig() {
  const url = String(SUPABASE_URL || "").trim();
  const key = String(SUPABASE_ANON_KEY || "").trim();
  return Boolean(
    url &&
    key &&
    !url.includes("your-project") &&
    !key.includes("your-anon-key") &&
    !key.endsWith("..."),
  );
}

export function ensureSupabaseConfig() {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase nicht konfiguriert: Bitte echte VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in Vercel Project Settings -> Environment Variables setzen.");
  }
}

function buildSupabaseHeaders(accessToken, headers = {}) {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };
}

export async function fetchSupabase(endpoint, options = {}) {
  ensureSupabaseConfig();

  const { accessToken, headers, ...requestOptions } = options;
  return fetch(`${SUPABASE_URL}${endpoint}`, {
    ...requestOptions,
    headers: buildSupabaseHeaders(accessToken, headers),
  });
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;

  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function readSupabaseResponse(response, fallbackMessage = "Supabase request failed") {
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const message = payload?.error_description
      || payload?.message
      || payload?.msg
      || payload?.error
      || `${fallbackMessage} (${response.status})`;
    throw new SupabaseRequestError(message, { status: response.status, payload });
  }

  return payload;
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase credentials missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env",
  );
}
