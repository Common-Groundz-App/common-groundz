import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicFlags {
  mux: {
    uploads_enabled: boolean;
    mode: 'live' | 'test';
  };
}

const DEFAULTS: PublicFlags = {
  mux: { uploads_enabled: true, mode: 'live' },
};

async function fetchPublicFlags(): Promise<PublicFlags> {
  const { data, error } = await supabase.rpc('get_public_flags');
  if (error) throw error;
  const muxRaw = (data as any)?.mux ?? {};
  return {
    mux: {
      uploads_enabled: muxRaw.uploads_enabled ?? true,
      mode: (muxRaw.mode === 'test' ? 'test' : 'live'),
    },
  };
}

/**
 * Read-only hook for public feature flags (admin panel readout, etc.).
 * Upload-time logic should use resolveMuxConfig() in mediaService instead.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app_config', 'public_flags'],
    queryFn: fetchPublicFlags,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: DEFAULTS,
  });
}
