import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export type AnalyzeUrlEngine = 'v1' | 'v2';

/**
 * Returns the currently selected entity URL extraction engine.
 *
 * - Admin-only flag. Non-admins ALWAYS receive `'v1'` (no DB call attempted).
 * - Reads `entity_extraction.version` from `public.app_config` (admin-gated RLS).
 * - Defaults to `'v1'` when the row is missing, the value is invalid,
 *   the request errors, or the admin check is still loading.
 *
 * Phase 1: hook exists and returns the selected engine; routing is wired
 * in a later phase. Until then, callers continue to use V1 directly.
 */
export function useAnalyzeUrlEngine(): {
  engine: AnalyzeUrlEngine;
  isLoading: boolean;
} {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const { data, isLoading: rowLoading } = useQuery({
    queryKey: ['app_config', 'entity_extraction.version'],
    enabled: isAdmin,
    staleTime: 10_000,
    queryFn: async (): Promise<AnalyzeUrlEngine> => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'entity_extraction.version')
        .maybeSingle();
      if (error) {
        console.warn('[useAnalyzeUrlEngine] read failed, defaulting to v1:', error.message);
        return 'v1';
      }
      const v = (data?.value as { version?: string } | null)?.version;
      return v === 'v2' ? 'v2' : 'v1';
    },
  });

  if (!isAdmin) return { engine: 'v1', isLoading: adminLoading };
  return { engine: data ?? 'v1', isLoading: adminLoading || rowLoading };
}
