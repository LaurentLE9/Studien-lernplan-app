import { waitForTrackedRequestsToSettle } from '../../e2e/helpers/app.js';

describe('E2E browser guard', () => {
  it('wartet vor einem Reload auf laufende Supabase-Requests und eine stabile Ruhephase', async () => {
    const pendingRequests = new Set(['initial-request']);
    let elapsedMs = 0;

    await waitForTrackedRequestsToSettle(
      pendingRequests,
      async (milliseconds) => {
        elapsedMs += milliseconds;
        if (elapsedMs === 100) pendingRequests.clear();
        if (elapsedMs === 200) pendingRequests.add('late-request');
        if (elapsedMs === 300) pendingRequests.clear();
      },
      { quietPeriodMs: 150, pollIntervalMs: 50, timeoutMs: 1000 },
    );

    expect(elapsedMs).toBe(450);
    expect(pendingRequests.size).toBe(0);
  });

  it('bricht mit einem klaren Fehler ab, wenn Requests nicht abgeschlossen werden', async () => {
    const pendingRequests = new Set(['stuck-request']);

    await expect(waitForTrackedRequestsToSettle(
      pendingRequests,
      async () => {},
      { quietPeriodMs: 50, pollIntervalMs: 50, timeoutMs: 100 },
    )).rejects.toThrow('Supabase-Requests wurden vor dem Reload nicht abgeschlossen (1 offen).');
  });
});
