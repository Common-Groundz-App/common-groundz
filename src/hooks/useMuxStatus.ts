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

    const apply = (row: {
      upload_id: string;
      status: MuxDbStatus;
      playback_id: string | null;
      asset_id: string | null;
      error: string | null;
    }) => {
      if (cancelled) return;
      const ui_status = normalizeMuxStatus(row.status);
      const next: MuxStatusRow = { ...row, ui_status };
      setStatuses((prev) => {
        const previous = prev[row.upload_id];
        if (
          previous &&
          previous.status === next.status &&
          previous.playback_id === next.playback_id &&
          previous.error === next.error
        ) {
          return prev;
        }
        try { onChangeRef.current?.(next, previous); } catch {}
        return { ...prev, [row.upload_id]: next };
      });
      if (ui_status === 'ready' && !firedReadyRef.current.has(row.upload_id)) {
        firedReadyRef.current.add(row.upload_id);
        try { onReadyRef.current?.(row.upload_id, next); } catch {}
      }
    };

    // (a) Initial fetch — seed cache + fire onReady for already-ready ids.
    (async () => {
      const { data, error } = await supabase
        .from('mux_uploads')
        .select('upload_id,status,playback_id,asset_id,error')
        .in('upload_id', cappedIds);
      if (error) {
        console.warn('[useMuxStatus] initial fetch failed', error);
        return;
      }
      (data ?? []).forEach((r: any) => apply(r));
    })();

    // (b) Realtime UPDATE subscription.
    const channel = supabase
      .channel(`mux-status-${cappedIds.join('|').slice(0, 64)}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mux_uploads',
          filter: `upload_id=in.(${cappedIds.join(',')})`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row?.upload_id) return;
          apply({
            upload_id: row.upload_id,
            status: row.status,
            playback_id: row.playback_id ?? null,
            asset_id: row.asset_id ?? null,
            error: row.error ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // Reset firedReady when id set changes so a fresh subscription can re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Reset fired-ready guard whenever id set changes.
  React.useEffect(() => {
    firedReadyRef.current = new Set();
  }, [idsKey]);

  return statuses;
}
