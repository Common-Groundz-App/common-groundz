import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * Global offline/reconnected banner. Mount once in App.tsx.
 * 
 * - Offline: persistent dark banner
 * - Back online: green banner, auto-dismisses after 3s
 *   (only shown if offline lasted 2+ seconds — prevents flicker)
 */
const OfflineBanner = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  const showOffline = !isOnline;
  const showReconnected = isOnline && wasOffline;

  return (
    <AnimatePresence>
      {showOffline && (
        <motion.div
          key="offline"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-muted border-b border-border text-muted-foreground text-center text-sm py-2 px-4 flex items-center justify-center gap-2 z-50"
        >
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Showing cached data.</span>
        </motion.div>
      )}
      {showReconnected && (
        <motion.div
          key="reconnected"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-green-600 text-white text-center text-sm py-2 px-4 flex items-center justify-center gap-2 z-50"
        >
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
