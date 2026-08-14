export function toIsoDateTimeOrNull(value) {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
