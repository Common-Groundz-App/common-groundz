import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export type AnalyzeUrlEngine = 'v1' | 'v2';

/**
 * Returns the currently selected entity URL extraction engine.
 *
 * - Admins: reads `entity_extraction.version` from `public.app_config`
 *   (admin-gated RLS). Defaults to `'v1'` on error/missing.
 * - Non-admins: routed to `'v2'` whenever the non-admin entity creation
 *   flag is ON (Phase 3.4). Otherwise `'v1'`. This uses the public
 *   `is_non_admin_entity_creation_enabled` RPC (SECURITY DEFINER), so
 *   the admin-only `entity_extraction.version` row is never queried by
 *   non-admins.
 */
export function useAnalyzeUrlEngine(): {
  engine: AnalyzeUrlEngine;
  isLoading: boolean;
} {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const adminQuery = useQuery({
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

  const nonAdminQuery = useQuery({
    queryKey: ['feature_flag', 'entity_creation.non_admin_enabled'],
    enabled: !adminLoading && !isAdmin,
    staleTime: 10_000,
    queryFn: async (): Promise<AnalyzeUrlEngine> => {
      const { data, error } = await supabase.rpc('is_non_admin_entity_creation_enabled');
      if (error) {
        console.warn('[useAnalyzeUrlEngine] non-admin flag read failed, defaulting to v1:', error.message);
        return 'v1';
      }
      return data === true ? 'v2' : 'v1';
    },
  });

  if (isAdmin) {
    return { engine: adminQuery.data ?? 'v1', isLoading: adminLoading || adminQuery.isLoading };
  }
  return { engine: nonAdminQuery.data ?? 'v1', isLoading: adminLoading || nonAdminQuery.isLoading };
}
