import { useEffect } from 'react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { setPrewarmEnabled } from '@/utils/prewarmMuxHls';

/**
 * Bridges the public `mux.prewarm_enabled` feature flag into the
 * in-memory prewarm module switch.
 *
 * Fail-open policy:
 *  - Only updates after a successful config read (`isSuccess`).
 *  - During loading or transient refetch failures, the existing in-memory
 *    value is left untouched. The module default is `true`, so first boot
 *    before any successful read still prewarms. This is intentional — the
 *    flag is a kill switch, not a hard gate, and prewarm has no playback
 *    or upload side effects.
 */
export function PrewarmFlagBridge() {
  const { data, isSuccess } = useAppConfig();

  useEffect(() => {
    if (!isSuccess || !data) return;
    setPrewarmEnabled(data.mux.prewarm_enabled);
  }, [isSuccess, data?.mux.prewarm_enabled]);

  return null;
}

export default PrewarmFlagBridge;
