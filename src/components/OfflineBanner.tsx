import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';

/**
 * Global offline/reconnected banner. Mount once in App.tsx.
 *
 * - Mobile (< xl): fixed bottom pill above bottom nav
 * - Desktop (xl+): fixed top bar
 * - Retry: real connectivity probe → refetch active queries
 * - Back online: green pill, auto-dismisses via wasOffline logic
 */
const RETRY_COOLDOWN = 5000;

const OfflineBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const [isRetrying, setIsRetrying] = useState(false);
  const [stillOffline, setStillOffline] = useState(false);
  const retryingRef = useRef(false);
  const cooldownRef = useRef(false);

  const showOffline = !isOnline;
  const showReconnected = isOnline && wasOffline;

  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: 'easeOut' as const };

  const handleRetry = useCallback(async () => {
    if (retryingRef.current || cooldownRef.current) return;
    retryingRef.current = true;
    setIsRetrying(true);
    setStillOffline(false);

    const online = await networkStatusService.probeConnectivity();

    if (online) {
      networkStatusService.reportSuccess();
      queryClient.refetchQueries({ type: 'active' });
    } else {
      setStillOffline(true);
      setTimeout(() => setStillOffline(false), 1500);
    }

    retryingRef.current = false;
    setIsRetrying(false);

    // Cooldown
    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, RETRY_COOLDOWN);
  }, [queryClient]);

  const offlineLabel = stillOffline ? 'Still offline' : "You're offline";

  // Pill content for offline state
  const renderOfflineContent = () => {
    if (isRetrying) {
      return (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span className="whitespace-nowrap">Reconnecting…</span>
        </>
      );
    }

    return (
      <>
        <WifiOff className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{offlineLabel}</span>
        <button
          onClick={handleRetry}
          disabled={cooldownRef.current}
          className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary active:scale-95 transition-transform disabled:cursor-not-allowed ml-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </>
    );
  };

  return (
    <AnimatePresence>
      {showOffline && (
        <>
          {/* Mobile: bottom pill */}
          <motion.div
            key="offline-mobile"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={motionTransition}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[41] min-w-[200px] max-w-[calc(100vw-2rem)] xl:hidden"
          >
            <div
              role="status"
              aria-live="polite"
              className={`flex items-center justify-center gap-2 rounded-full bg-muted border border-border/60 shadow-lg px-4 py-2.5 text-sm text-muted-foreground transition-all duration-200 ease-out ${isRetrying ? 'animate-pulse' : ''}`}
            >
              {renderOfflineContent()}
            </div>
          </motion.div>

          {/* Desktop: top bar */}
          <motion.div
            key="offline-desktop"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={motionTransition}
            className="hidden xl:flex bg-muted border-b border-border text-muted-foreground text-center text-sm py-2 px-4 items-center justify-center gap-2 z-50"
            role="status"
            aria-live="polite"
          >
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Reconnecting…</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>{offlineLabel}</span>
                <button
                  onClick={handleRetry}
                  disabled={cooldownRef.current}
                  className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary active:scale-95 transition-transform disabled:cursor-not-allowed ml-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </>
            )}
          </motion.div>
        </>
      )}

      {showReconnected && (
        <>
          {/* Mobile: bottom pill */}
          <motion.div
            key="reconnected-mobile"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={motionTransition}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[41] min-w-[200px] max-w-[calc(100vw-2rem)] xl:hidden"
          >
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 rounded-full bg-green-600 shadow-lg px-4 py-2.5 text-sm text-white transition-all duration-200 ease-out"
            >
              <Wifi className="h-4 w-4" />
              <span>Back online</span>
            </div>
          </motion.div>

          {/* Desktop: top bar */}
          <motion.div
            key="reconnected-desktop"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={motionTransition}
            className="hidden xl:flex bg-green-600 text-white text-center text-sm py-2 px-4 items-center justify-center gap-2 z-50"
            role="status"
            aria-live="polite"
          >
            <Wifi className="h-4 w-4" />
            <span>Back online</span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
