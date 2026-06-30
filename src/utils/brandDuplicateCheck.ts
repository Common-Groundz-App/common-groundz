// Plan v10 — manual "Create new brand…" duplicate check.
// Runs under admin JWT (caller must be admin or RPC returns empty).
// Two-step: (1) RPC trigram match, (2) refetch ids with strict filters
// to exclude rejected/deleted/non-brand rows the RPC does not filter.
import { supabase } from '@/integrations/supabase/client';
import { normalizeBrandName } from './brandNormalize';

export interface BrandDuplicateMatch {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  website_url: string | null;
  /** True when this row's normalized name === normalized input. */
  isExactNormalized: boolean;
}

export async function brandDuplicateCheck(rawName: string): Promise<BrandDuplicateMatch[]> {
  const name = (rawName ?? '').trim();
  if (name.length < 2) return [];
  const normalizedInput = normalizeBrandName(name);

  try {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('match_entities_by_name', {
      _name: name,
      _type: 'brand',
      _threshold: 0.6,
      _limit: 5,
    });
    if (rpcErr) {
      console.warn('[brandDuplicateCheck] RPC error:', rpcErr.message);
      return [];
    }
    const ids: string[] = (rpcRows ?? [])
      .map((r: { id?: string }) => r?.id)
      .filter((x: string | undefined): x is string => !!x);
    if (ids.length === 0) return [];

    const { data: safe, error: safeErr } = await supabase
      .from('entities')
      .select('id, name, slug, image_url, website_url, approval_status, is_deleted, type')
      .in('id', ids)
      .eq('type', 'brand')
      .eq('is_deleted', false)
      .neq('approval_status', 'rejected');

    if (safeErr || !safe) return [];

    return safe.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      slug: (r.slug as string | null) ?? null,
      image_url: (r.image_url as string | null) ?? null,
      website_url: (r.website_url as string | null) ?? null,
      isExactNormalized:
        normalizeBrandName(r.name as string) === normalizedInput ||
        (!!r.slug && normalizeBrandName(r.slug as string) === normalizedInput),
    }));
  } catch (e) {
    console.warn('[brandDuplicateCheck] threw:', String(e));
    return [];
  }
}
