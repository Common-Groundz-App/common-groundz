import { useSyncExternalStore } from 'react';
import { networkStatusService } from '@/services/networkStatusService';

/**
 * React hook for network status. All consumers share the same
 * singleton state from networkStatusService.
 * 
 * Do NOT use navigator.onLine directly — use this hook instead.
 */
export function useNetworkStatus() {
  const state = useSyncExternalStore(
    networkStatusService.subscribe,
    networkStatusService.getSnapshot,
    networkStatusService.getServerSnapshot
  );

  return {
    isOnline: state.isOnline,
    wasOffline: state.wasOffline,
  };
}
