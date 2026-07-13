// Phase 3.5a — reads the app_config flag that controls whether non-admin
// users see the Search tab in Create Entity. Admins always see it.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';

async function fetchFlag(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_non_admin_search_to_draft_enabled');
  if (error) {
    console.warn('[useSearchToDraftEnabled] rpc failed:', error.message);
    return false;
  }
  return data === true;
}

export function useSearchToDraftEnabled(): boolean {
  const { isAdmin } = useIsAdmin();
  const { data } = useQuery({
    queryKey: ['app_config', 'search_to_draft.non_admin_enabled'],
    queryFn: fetchFlag,
    staleTime: 30_000,
  });
  return isAdmin || data === true;
}
