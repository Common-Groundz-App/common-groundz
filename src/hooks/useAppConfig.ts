import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicFlags {
  mux: {
    uploads_enabled: boolean;
    prewarm_enabled: boolean;
    mode: 'live' | 'test';
  };
  notifications: {
    realtime_enabled: boolean;
  };
}

const DEFAULTS: PublicFlags = {
  mux: { uploads_enabled: true, prewarm_enabled: true, mode: 'live' },
  notifications: { realtime_enabled: true },
};

async function fetchPublicFlags(): Promise<PublicFlags> {
  const { data, error } = await supabase.rpc('get_public_flags');
  if (error) throw error;
  const muxRaw = (data as any)?.mux ?? {};
  const notificationsRaw = (data as any)?.notifications ?? {};
  return {
    mux: {
      uploads_enabled: muxRaw.uploads_enabled ?? true,
      prewarm_enabled: muxRaw.prewarm_enabled ?? true,
      mode: (muxRaw.mode === 'test' ? 'test' : 'live'),
    },
    notifications: {
      realtime_enabled: notificationsRaw.realtime_enabled ?? true,
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

/**
 * Realtime kill switch, resolved for CONSUMERS rather than for display.
 *
 * `placeholderData` above means `data` is never undefined, so a naive
 * `data.notifications.realtime_enabled` read would report "enabled" during the
 * very first fetch and open a channel we may be about to be told not to open.
 * Gating on `status === 'success'` (and treating an outright fetch failure as
 * "off", falling back to polling) is why this is a separate hook.
 */
export function useNotificationsRealtimeEnabled(): boolean {
  const { data, status, isPlaceholderData } = useAppConfig();
  if (status !== 'success' || isPlaceholderData) return false;
  return data?.notifications?.realtime_enabled === true;
}
