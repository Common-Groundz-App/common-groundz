import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  chunkTargetIds,
  collectTargetIds,
  getNotificationTargetRef,
  resolvePostThumbnail,
  resolveRecommendationThumbnail,
  type ThumbnailTargetType,
} from '@/utils/notificationThumbnail';

/**
 * Phase 3.3A — batched, account-scoped lookup of the media belonging to the
 * CONTENT a notification points at.
 *
 * Contract:
 *  - one query family per entity type; `ceil(unique/200)` bounded requests each
 *    (in practice one), never one request per row.
 *  - only the unique targets currently loaded in the active list.
 *  - chunk keys are sorted, so the same loaded set reuses the same cache entry.
 *  - the cache key carries `user.id`: RLS visibility is account-specific, so a
 *    thumbnail resolved for one account must never surface for another.
 *  - RLS/deleted/absent rows simply do not come back and resolve to no
 *    thumbnail (no placeholder).
 */

export type NotificationTargetMedia = {
  /** target key (`post:<id>` / `recommendation:<id>`) -> renderable image URL */
  thumbnails: Map<string, string>;
  /** true while any chunk is still in flight */
  isLoading: boolean;
  /** keys whose owning chunk has conclusively resolved */
  resolvedKeys: Set<string>;
};

const targetKey = (type: ThumbnailTargetType, id: string) => `${type}:${id}`;

type ChunkResult = {
  entityType: ThumbnailTargetType;
  ids: string[];
  thumbnails: Array<[string, string]>;
};

const fetchChunk = async (
  entityType: ThumbnailTargetType,
  ids: string[],
): Promise<ChunkResult> => {
  const thumbnails: Array<[string, string]> = [];

  if (entityType === 'post') {
    const { data, error } = await supabase
      .from('posts')
      .select('id, media')
      .in('id', ids)
      .eq('is_deleted', false);
    if (error) throw error;
    for (const row of data ?? []) {
      const url = resolvePostThumbnail((row as { media?: unknown }).media);
      if (url) thumbnails.push([targetKey('post', (row as { id: string }).id), url]);
    }
  } else {
    const { data, error } = await supabase
      .from('recommendations')
      .select('id, image_url')
      .in('id', ids);
    if (error) throw error;
    for (const row of data ?? []) {
      const url = resolveRecommendationThumbnail((row as { image_url?: unknown }).image_url);
      if (url) thumbnails.push([targetKey('recommendation', (row as { id: string }).id), url]);
    }
  }

  return { entityType, ids, thumbnails };
};

type TargetSource = { entity_type?: string | null; entity_id?: string | null };

export function useNotificationTargets(
  rows: ReadonlyArray<TargetSource | null | undefined>,
): NotificationTargetMedia {
  const { user } = useAuth();
  const accountId = user?.id ?? null;

  const chunks = useMemo(() => {
    if (!accountId || rows.length === 0) return [] as Array<{ entityType: ThumbnailTargetType; ids: string[] }>;
    const byType = collectTargetIds(rows);
    return (Object.keys(byType) as ThumbnailTargetType[]).flatMap((entityType) =>
      chunkTargetIds(byType[entityType]).map((ids) => ({ entityType, ids })),
    );
  }, [rows, accountId]);

  const results = useQueries({
    queries: chunks.map(({ entityType, ids }) => ({
      // accountId is part of the key: RLS visibility differs per user.
      queryKey: ['notification-targets', accountId, entityType, ids.join(',')],
      queryFn: () => fetchChunk(entityType, ids),
      enabled: !!accountId && ids.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    })),
  });

  return useMemo(() => {
    const thumbnails = new Map<string, string>();
    const resolvedKeys = new Set<string>();
    let isLoading = false;

    results.forEach((result, index) => {
      const chunk = chunks[index];
      if (!chunk) return;
      if (result.isPending) {
        isLoading = true;
        return;
      }
      // Settled (success OR error): the slot must not stay reserved forever.
      for (const id of chunk.ids) resolvedKeys.add(targetKey(chunk.entityType, id));
      const data = result.data as ChunkResult | undefined;
      for (const [key, url] of data?.thumbnails ?? []) thumbnails.set(key, url);
    });

    return { thumbnails, isLoading, resolvedKeys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, results.map((r) => `${r.status}:${r.dataUpdatedAt}`).join('|')]);
}

/** Row-level lookup: the URL when known, plus whether it is still resolving. */
export function selectTargetThumbnail(
  media: NotificationTargetMedia,
  row: TargetSource | null | undefined,
): { url: string | null; pending: boolean } {
  const ref = getNotificationTargetRef(row);
  if (!ref) return { url: null, pending: false };
  const key = targetKey(ref.entityType, ref.entityId);
  const url = media.thumbnails.get(key) ?? null;
  return { url, pending: !url && !media.resolvedKeys.has(key) };
}
