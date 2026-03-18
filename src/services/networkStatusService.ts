/**
 * Global Network Status Service (Singleton)
 * 
 * Single source of truth for network connectivity status.
 * All network checks in the app MUST go through this service.
 * Do NOT use navigator.onLine directly anywhere else.
 * 
 * Only transport-level failures count toward offline detection:
 * - TypeError: Failed to fetch (network unreachable)
 * - AbortError (request aborted due to connectivity)
 * - Explicit timeouts
 * - Browser offline events
 * 
 * Application errors (4xx/5xx) are NOT counted as network failures.
 */

type NetworkState = {
  isOnline: boolean;
  wasOffline: boolean;
  failureCount: number;
};

type Subscriber = () => void;

const FAILURE_THRESHOLD = 3;
const WAS_OFFLINE_DURATION = 3000; // ms to keep wasOffline=true after reconnection

let state: NetworkState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  wasOffline: false,
  failureCount: 0,
};

let subscribers: Set<Subscriber> = new Set();
let wasOfflineTimer: ReturnType<typeof setTimeout> | null = null;
let offlineSince: number | null = null;
let listenersAttached = false;

function notify() {
  subscribers.forEach((fn) => fn());
}

function goOffline() {
  if (!state.isOnline) return;
  offlineSince = Date.now();
  state = { ...state, isOnline: false };
  notify();
}

function goOnline() {
  if (state.isOnline && !state.wasOffline) return;

  const wasOfflineLongEnough = offlineSince !== null && (Date.now() - offlineSince) >= 2000;
  offlineSince = null;

  state = {
    isOnline: true,
    wasOffline: wasOfflineLongEnough,
    failureCount: 0,
  };
  notify();

  // Clear wasOffline after a delay
  if (wasOfflineLongEnough) {
    if (wasOfflineTimer) clearTimeout(wasOfflineTimer);
    wasOfflineTimer = setTimeout(() => {
      state = { ...state, wasOffline: false };
      wasOfflineTimer = null;
      notify();
    }, WAS_OFFLINE_DURATION);
  }
}

function handleBrowserOnline() {
  goOnline();
}

function handleBrowserOffline() {
  goOffline();
}

function attachListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('online', handleBrowserOnline);
  window.addEventListener('offline', handleBrowserOffline);
  listenersAttached = true;
}

// Attach listeners immediately on module load
attachListeners();

/**
 * Checks if an error is a transport-level network failure.
 * Only these errors count toward the offline failure threshold.
 */
function isTransportError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network request failed') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    );
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }

  // Explicit timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return true;
    }
  }

  return false;
}

export const networkStatusService = {
  /**
   * Report a fetch/network failure. Only transport-level errors
   * increment the failure counter. Application errors (4xx/5xx) are ignored.
   */
  reportFailure(error: unknown) {
    if (!isTransportError(error)) return;

    const newCount = state.failureCount + 1;
    state = { ...state, failureCount: newCount };

    if (newCount >= FAILURE_THRESHOLD) {
      goOffline();
    } else {
      notify();
    }
  },

  /**
   * Report a successful network request. Resets the failure counter
   * and transitions to online if currently offline.
   */
  reportSuccess() {
    if (state.failureCount === 0 && state.isOnline) return;

    if (!state.isOnline) {
      goOnline();
    } else {
      state = { ...state, failureCount: 0 };
      notify();
    }
  },

  /** Get current snapshot of network state (for useSyncExternalStore) */
  getSnapshot(): NetworkState {
    return state;
  },

  /** Subscribe to state changes (for useSyncExternalStore) */
  subscribe(callback: Subscriber): () => void {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  },

  /** Server snapshot — always online (for SSR) */
  getServerSnapshot(): NetworkState {
    return { isOnline: true, wasOffline: false, failureCount: 0 };
  },
};
