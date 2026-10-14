import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';

// DB enum on public.mux_uploads.status
export type MuxDbStatus =
  | 'waiting'
  | 'asset_created'
  | 'ready'
  | 'errored'
  | 'cancelled';

// UI-only normalization
export type MuxUiStatus = 'processing' | 'ready' | 'failed';

export interface MuxStatusRow {
  upload_id: string;
  status: MuxDbStatus;
  ui_status: MuxUiStatus;
  playback_id: string | null;
  asset_id: string | null;
  error: string | null;
  duration?: number | null;
  updated_at?: string | null;
}

export type MuxStatusMap = Record<string, MuxStatusRow>;

interface Options {
  /**
   * Fires exactly once per upload_id per hook instance lifetime when the
   * hook first observes ui_status === 'ready'. Fires from either initial
   * fetch or a realtime UPDATE.
   */
  onReady?: (uploadId: string, row: MuxStatusRow) => void;
  /**
   * Fires on every status transition (including initial seed). Useful for
   * analytics.
   */
  onChange?: (row: MuxStatusRow, prev: MuxStatusRow | undefined) => void;
}

export function normalizeMuxStatus(s: MuxDbStatus): MuxUiStatus {
  if (s === 'ready') return 'ready';
  if (s === 'errored' || s === 'cancelled') return 'failed';
  return 'processing';
}

const MAX_IDS_PER_CHANNEL = 8;

/**
 * Subscribe to mux_uploads status for a set of upload_ids.
 *
 * Phase 5 — read-only, owner/composer-facing only. Do not call this on
 * viewer feed cards.
 */
export function useMuxStatus(
  uploadIds: string[] | null | undefined,
  options: Options = {},
): MuxStatusMap {
  const { onReady, onChange } = options;

  // Stable id-set key so effect doesn't re-run on every array identity change.
  const idsKey = React.useMemo(() => {
    if (!uploadIds || uploadIds.length === 0) return '';
    return Array.from(new Set(uploadIds.filter(Boolean))).sort().join(',');
  }, [uploadIds]);

  const [statuses, setStatuses] = React.useState<MuxStatusMap>({});

  // Internal guard: onReady fires at most once per upload_id per hook instance.
  const firedReadyRef = React.useRef<Set<string>>(new Set());
  const onReadyRef = React.useRef(onReady);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  React.useEffect(() => {
    if (!idsKey) {
      setStatuses({});
      firedReadyRef.current = new Set();
      return;
    }

    const ids = idsKey.split(',');
    if (ids.length > MAX_IDS_PER_CHANNEL) {
      console.warn(
        `[useMuxStatus] ${ids.length} upload ids exceeds cap of ${MAX_IDS_PER_CHANNEL}; only the first ${MAX_IDS_PER_CHANNEL} will be subscribed.`,
      );
    }
    const cappedIds = ids.slice(0, MAX_IDS_PER_CHANNEL);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reads = 0;
    let readSequence = 0;
    const revisions = new Map<string, number>();
    const latestRows: MuxStatusMap = {};
    setStatuses((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => cappedIds.includes(id))));

    const apply = (row: Omit<MuxStatusRow, 'ui_status'>) => {
      if (cancelled || !cappedIds.includes(row.upload_id)) return;
      const previous = latestRows[row.upload_id];
      if (previous?.updated_at && row.updated_at && row.updated_at < previous.updated_at) return;
      const next = { ...row, ui_status: normalizeMuxStatus(row.status) };
      latestRows[row.upload_id] = next;
      setStatuses((prev) => ({ ...prev, [row.upload_id]: next }));
      if (!previous || JSON.stringify(previous) !== JSON.stringify(next)) {
        try { onChangeRef.current?.(next, previous); } catch {}
      }
      if (next.ui_status === 'ready' && !firedReadyRef.current.has(row.upload_id)) {
        firedReadyRef.current.add(row.upload_id);
        try { onReadyRef.current?.(row.upload_id, next); } catch {}
      }
    };

    // Bounded owner-only reconciliation when realtime misses a duration update.
    // No viewer polling and no reads while hidden/offline.
    const canRead = () => typeof document === 'undefined' || (!document.hidden && navigator.onLine);
    const pending = () => cappedIds.some((id) => {
      const row = latestRows[id];
      return !row || (row.ui_status !== 'failed' && !row.error &&
        !(row.ui_status === 'ready' && row.asset_id && row.playback_id &&
          typeof row.duration === 'number' && Number.isFinite(row.duration) && row.duration > 0));
    });
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (!cancelled && reads < 40 && pending() && canRead()) timer = setTimeout(() => void read(), 3000);
    };
    const read = async () => {
      if (cancelled || !canRead()) return;
      const sequence = ++readSequence;
      const atStart = new Map(revisions);
      reads += 1;
      try {
        const { data, error } = await supabase.from('mux_uploads')
          .select('upload_id,status,playback_id,asset_id,error,duration,updated_at').in('upload_id', cappedIds);
        if (cancelled || sequence !== readSequence) return;
        if (!error) (data ?? []).forEach((row) => {
          // A delayed fetch must not overwrite a newer realtime event.
          if ((atStart.get(row.upload_id) ?? 0) === (revisions.get(row.upload_id) ?? 0)) apply(row);
        });
      } catch { /* background reads fail silently; manual recheck remains available */ }
      finally { if (!cancelled && sequence === readSequence) schedule(); }
    };
    const recheck = () => { if (canRead()) { reads = 0; void read(); } };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', recheck);
      window.addEventListener('mux:recheck', recheck);
      document.addEventListener('visibilitychange', recheck);
    }
    const channel = supabase
      .channel(`mux-status-${cappedIds.join('|').slice(0, 64)}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'mux_uploads',
        filter: `upload_id=in.(${cappedIds.join(',')})`,
      }, (payload: any) => {
        const row = payload?.new;
        if (!row?.upload_id) return;
        revisions.set(row.upload_id, (revisions.get(row.upload_id) ?? 0) + 1);
        apply({ upload_id: row.upload_id, status: row.status, playback_id: row.playback_id ?? null,
          asset_id: row.asset_id ?? null, error: row.error ?? null, duration: row.duration ?? null,
          updated_at: row.updated_at ?? null });
        schedule();
      }).subscribe((status) => { if (status === 'SUBSCRIBED') void read(); });
    void read();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', recheck);
        window.removeEventListener('mux:recheck', recheck);
        document.removeEventListener('visibilitychange', recheck);
      }
      void supabase.removeChannel(channel);
    };
    // Reset firedReady when id set changes so a fresh subscription can re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Reset fired-ready guard whenever id set changes.
  React.useEffect(() => {
    firedReadyRef.current = new Set();
  }, [idsKey]);

  return Object.fromEntries(Object.entries(statuses).filter(([id]) => idsKey.split(',').includes(id)));
}
