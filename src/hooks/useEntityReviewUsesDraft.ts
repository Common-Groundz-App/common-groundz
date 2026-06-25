import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';

/**
 * Phase 3.2 — admin-only feature flag hook for the draft-driven entity
 * review UI. Returns `false` for non-admins and during loading. Default OFF.
 *
 * Reads `app_config['entity_extraction.review_uses_draft'].enabled`.
 */
export function useEntityReviewUsesDraft(): boolean {
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (adminLoading || !isAdmin) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'entity_extraction.review_uses_draft')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setEnabled(false);
          return;
        }
        const v = (data?.value as { enabled?: boolean } | null) ?? null;
        setEnabled(!!v?.enabled);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, adminLoading]);

  return isAdmin && enabled;
}
