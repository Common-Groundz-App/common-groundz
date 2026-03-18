import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { networkStatusService } from '@/services/networkStatusService';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, Loader2 } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';

type PillVisual = 'offline' | 'reconnecting' | 'still-offline';

const RETRY_COOLDOWN = 5000;
const MIN_RECONNECTING_MS = 800;
const STILL_OFFLINE_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const OfflineBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [pillState, setPillState] = useState<PillVisual>('offline');
  const [isCoolingDown, setIsCoolingDown] = useState(false);

  const retryingRef = useRef(false);
  const cycleRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const revertTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTimers = useCallback(() => {
    clearTimeout(cooldownTimerRef.current);
    clearTimeout(revertTimerRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cycleRef.current += 1;
      clearTimers();
    };
  }, [clearTimers]);

  // Reset when coming back online
  useEffect(() => {
    if (isOnline) {
      cycleRef.current += 1;
      clearTimers();
      setPillState('offline');
      setIsCoolingDown(false);
      retryingRef.current = false;
    }
  }, [isOnline, clearTimers]);

  const showOffline = !isOnline;
  const showReconnected = isOnline && wasOffline;

  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: 'easeOut' as const };

  const handleRetry = useCallback(async () => {
    if (retryingRef.current || isCoolingDown) return;

    cycleRef.current += 1;
    const cycle = cycleRef.current;
    clearTimers();

    retryingRef.current = true;
    setPillState('reconnecting');

    const [online] = await Promise.all([
      networkStatusService.probeConnectivity(),
      sleep(MIN_RECONNECTING_MS),
    ]);

    if (cycle !== cycleRef.current) return;

    if (online) {
      networkStatusService.reportSuccess();
      queryClient.refetchQueries({ type: 'active' });
    } else {
      setPillState('still-offline');
      revertTimerRef.current = setTimeout(() => {
        if (cycle !== cycleRef.current) return;
        setPillState('offline');
      }, STILL_OFFLINE_MS);
    }

    retryingRef.current = false;

    setIsCoolingDown(true);
    cooldownTimerRef.current = setTimeout(() => {
      if (cycle !== cycleRef.current) return;
      setIsCoolingDown(false);
    }, RETRY_COOLDOWN);
  }, [isCoolingDown, queryClient, clearTimers]);

  const renderPillContent = () => {
    switch (pillState) {
      case 'reconnecting':
        return (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            <span className="whitespace-nowrap">Reconnecting…</span>
          </>
        );
      case 'still-offline':
        return (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Still offline</span>
          </>
        );
      case 'offline':
      default:
        return (
          <>
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">You're offline</span>
            <button
              onClick={handleRetry}
              disabled={isCoolingDown}
              className="flex items-center gap-1 text-xs font-medium text-foreground hover:text-primary active:scale-95 transition-transform disabled:cursor-not-allowed disabled:opacity-50 ml-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </>
        );
    }
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
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[41] flex justify-center px-4 pointer-events-none xl:hidden"
          >
            <div
              role="status"
              aria-live="polite"
              className={`pointer-events-auto min-w-[200px] max-w-[calc(100vw-2rem)] flex items-center justify-center gap-2 rounded-full bg-muted border border-border/60 shadow-lg px-4 py-2.5 text-sm text-muted-foreground transition-all duration-200 ease-out ${pillState === 'reconnecting' ? 'animate-pulse' : ''}`}
            >
              {renderPillContent()}
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
            {renderPillContent()}
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
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[41] flex justify-center px-4 pointer-events-none xl:hidden"
          >
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto min-w-[200px] max-w-[calc(100vw-2rem)] flex items-center justify-center gap-2 rounded-full bg-green-600 shadow-lg px-4 py-2.5 text-sm text-white transition-all duration-200 ease-out"
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
