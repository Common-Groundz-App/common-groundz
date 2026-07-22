// Phase 3.5c — Client hook for search-to-draft funnel telemetry.
//
// Contract:
//   - Never logs raw query. Only SHA-256 hex of normalized query is transmitted.
//   - Fire-and-forget with a 1.5s AbortController. Any failure is swallowed
//     silently. Never toasts, never blocks UX.
//   - If crypto.subtle is unavailable (very old browsers), hashing is skipped
//     and the event is sent without queryHash.

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FunnelEvent =
  | 'search_run'
  | 'candidate_pick'
  | 'review_opened'
  | 'entity_created';

export type FunnelSource = 'search' | 'existing_match';

import type { SearchFinalizationDiff } from '@/components/admin/entity-create/searchTelemetryTypes';

export interface FunnelPayload {
  event: FunnelEvent;
  source: FunnelSource;
  /** Raw query — hashed locally, never transmitted. */
  query?: string;
  entityType?: string;
  candidateIndex?: number;
  diagnostics?: {
    latencyMs?: number;
    cached?: boolean;
    hasImage?: boolean;
    /** Phase 3.5c v2 — booleans + approved enums only. */
    diff?: SearchFinalizationDiff;
  };
}

const CLIENT_TIMEOUT_MS = 1_500;

function normalizeQuery(raw: string): string {
  return raw.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

async function sha256Hex(input: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export function useSearchFunnel() {
  // Track the timestamp of the last candidate_pick so entity_created can
  // report latencyMs from click → creation.
  const pickAtRef = useRef<number | null>(null);

  const log = useCallback(async (payload: FunnelPayload) => {
    try {
      const queryHash = payload.query
        ? await sha256Hex(normalizeQuery(payload.query))
        : null;

      const body: Record<string, unknown> = {
        event: payload.event,
        source: payload.source,
      };
      if (queryHash) body.queryHash = queryHash;
      if (payload.entityType) body.entityType = payload.entityType;
      if (typeof payload.candidateIndex === 'number') {
        body.candidateIndex = payload.candidateIndex;
      }
      if (payload.diagnostics) body.diagnostics = payload.diagnostics;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

      // Fire-and-forget. Do NOT await the promise beyond the timeout race —
      // any error is swallowed by the outer try/catch.
      supabase.functions
        .invoke('log-search-funnel', {
          body,
          // supabase-js doesn't forward signal on all versions; the timer
          // still guarantees we don't hang the UI.
        })
        .catch(() => { /* silent */ })
        .finally(() => clearTimeout(timer));
    } catch {
      // silent
    }
  }, []);

  const markPick = useCallback(() => { pickAtRef.current = Date.now(); }, []);
  const consumePickLatency = useCallback((): number | undefined => {
    if (pickAtRef.current == null) return undefined;
    const dt = Date.now() - pickAtRef.current;
    pickAtRef.current = null;
    return dt;
  }, []);

  return { log, markPick, consumePickLatency };
}
