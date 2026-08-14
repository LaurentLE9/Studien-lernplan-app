export const POSTGRES_INTEGER_MAX = 2_147_483_647;

export function clampPostgresInteger(value, options = {}) {
  const minimum = Number.isInteger(options.minimum) ? options.minimum : 0;
  const fallback = Number.isFinite(Number(options.fallback))
    ? Number(options.fallback)
    : minimum;
  const numeric = Number(value);
  const normalized = Number.isFinite(numeric) ? Math.trunc(numeric) : Math.trunc(fallback);
  return Math.min(POSTGRES_INTEGER_MAX, Math.max(minimum, normalized));
}

export function clampPostgresDurationMinutes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(POSTGRES_INTEGER_MAX, Math.max(1, Math.round(numeric)));
}
