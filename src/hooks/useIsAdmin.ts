import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Lightweight hook returning whether the current user has the 'admin' role.
 * Calls the `has_role` security-definer RPC to avoid recursive RLS issues.
 *
 * Returns `false` until the check resolves (and on any error). Used to
 * bypass the post edit window for moderators — never for granting privileged
 * UI access. Privileged surfaces should re-check server-side.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('[useIsAdmin] has_role check failed:', error.message);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isAdmin, isLoading };
}
