/**
 * Explicit composer abandonment of session-new Mux uploads.
 * Feeds the existing cleanup queue via `mux_abandon_composer_uploads`; the
 * server derives kind, checks ownership and refuses saved media. Delivery is
 * best-effort: requests are tracked and retried, never assumed delivered.
 */
import { supabase } from '@/integrations/supabase/client';
import type { MediaItem } from '@/types/media';

export type AbandonReason = 'composer_media_removed' | 'composer_media_replaced' | 'composer_discarded';
export type AbandonResult = 'acknowledged' | 'failed';

type Rpc = (ids: string[], reason: AbandonReason) => Promise<{ error: unknown }>;

const defaultRpc: Rpc = async (ids, reason) =>
  (await (supabase.rpc as any)('mux_abandon_composer_uploads', { p_upload_ids: ids, p_reason: reason })) as { error: unknown };

let rpc: Rpc = defaultRpc;
const pending = new Set<Promise<AbandonResult>>();
const inFlight = new Map<string, Promise<AbandonResult>>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Session-new Mux upload ids: present now, absent from the saved media. */
export function sessionNewMuxIds(items: readonly MediaItem[], saved: readonly MediaItem[] = []): string[] {
  const savedIds = new Set(saved.map((m) => m.mux_upload_id).filter(Boolean) as string[]);
  return [...new Set(items.map((m) => m.mux_upload_id).filter((id): id is string => !!id && !savedIds.has(id)))];
}

export function abandonMuxUploads(ids: readonly string[], reason: AbandonReason, attempts = 3): Promise<AbandonResult> {
  const fresh = [...new Set(ids.filter(Boolean))].filter((id) => !inFlight.has(id));
  if (fresh.length === 0) return Promise.resolve('acknowledged');
  const p = (async (): Promise<AbandonResult> => {
    for (let i = 0; i < attempts; i++) {
      try {
        const { error } = await rpc(fresh.slice(0, 8), reason);
        if (!error) return 'acknowledged';
      } catch { /* retry */ }
      if (i < attempts - 1) await wait(400 * 2 ** i);
    }
    console.warn('[mux-abandon] cleanup request not acknowledged', { count: fresh.length, reason });
    return 'failed';
  })();
  fresh.forEach((id) => inFlight.set(id, p));
  pending.add(p);
  void p.finally(() => {
    pending.delete(p);
    fresh.forEach((id) => { if (inFlight.get(id) === p) inFlight.delete(id); });
  });
  return p;
}

/** Bounded wait for every started request (incl. earlier tile removals). A timeout neither cancels nor confirms. */
export async function flushMuxAbandonments(timeoutMs = 1500): Promise<'settled' | 'timed_out'> {
  if (pending.size === 0) return 'settled';
  let t: ReturnType<typeof setTimeout> | undefined;
  const r = await Promise.race([
    Promise.allSettled([...pending]).then(() => 'settled' as const),
    new Promise<'timed_out'>((res) => { t = setTimeout(() => res('timed_out'), timeoutMs); }),
  ]);
  if (t) clearTimeout(t);
  return r;
}

export function __setAbandonRpcForTests(fn: Rpc | null) { rpc = fn ?? defaultRpc; pending.clear(); inFlight.clear(); }
