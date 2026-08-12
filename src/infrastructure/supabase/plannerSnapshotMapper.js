export function readPlannerSnapshotRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { found: false, snapshot: null };
  }

  return {
    found: true,
    snapshot: rows[0]?.data || {},
  };
}

export function buildPlannerSnapshotUpsert(userId, plannerData) {
  return {
    user_id: userId,
    data: plannerData,
  };
}
