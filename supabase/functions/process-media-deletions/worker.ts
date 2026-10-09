// Pure worker loop for D2 (dependencies injected so it can be tested).
export interface Claim { path: string; claim_token: string }

export interface WorkerDeps {
  recheckKept(): Promise<number>;
  claim(limit: number, leaseSeconds: number): Promise<Claim[]>;
  processingEnabled(): Promise<boolean>;
  /** Resolves to null on success (including "already missing"), else an error message. */
  removeObject(path: string): Promise<string | null>;
  finish(path: string, token: string, outcome: 'deleted' | 'error', error?: string): Promise<string>;
}

export interface WorkerReport {
  requeued: number;
  claimed: number;
  deleted: number;
  retry: number;
  failed: number;
  stale: number;
  skippedProcessingOff: string[];
}

export async function runWorker(deps: WorkerDeps, limit = 25, leaseSeconds = 300): Promise<WorkerReport> {
  const report: WorkerReport = { requeued: 0, claimed: 0, deleted: 0, retry: 0, failed: 0, stale: 0, skippedProcessingOff: [] };
  report.requeued = await deps.recheckKept();
  const claims = await deps.claim(limit, leaseSeconds);
  report.claimed = claims.length;
  for (const c of claims) {
    // Re-check the switch right before each storage call. Skipped claims stay
    // 'deleting' (re-attachment blocked) and are re-claimed after the lease.
    if (!(await deps.processingEnabled())) {
      report.skippedProcessingOff.push(c.path);
      continue;
    }
    let err: string | null;
    try {
      err = await deps.removeObject(c.path);
    } catch (e) {
      err = (e as Error)?.message ?? 'unknown storage error';
    }
    const outcome = await deps.finish(c.path, c.claim_token, err ? 'error' : 'deleted', err ?? undefined);
    if (outcome === 'deleted') report.deleted++;
    else if (outcome === 'retry') report.retry++;
    else if (outcome === 'failed') report.failed++;
    else report.stale++;
  }
  return report;
}
