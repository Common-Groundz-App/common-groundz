/**
 * Location prompt snooze rules, copied from the legacy photos step (which
 * stays frozen): 24h after it was shown, 2h after Skip. One deliberate fix —
 * "last shown" is recorded when the prompt actually appears.
 */
export const LAST_SHOWN_KEY = 'locationPromptLastShown';
export const LAST_SKIPPED_KEY = 'locationPromptLastSkipped';
const SHOWN_TIMEOUT = 24 * 60 * 60 * 1000;
const SKIPPED_TIMEOUT = 2 * 60 * 60 * 1000;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function shouldShowLocationPrompt(args: {
  eligible: boolean;
  locationEnabled: boolean;
  permissionStatus: string;
  now: number;
  storage: Store;
}): boolean {
  const { eligible, locationEnabled, permissionStatus, now, storage } = args;
  if (!eligible || locationEnabled || permissionStatus === 'granted') return false;
  const skipped = storage.getItem(LAST_SKIPPED_KEY);
  if (skipped) return now - parseInt(skipped, 10) > SKIPPED_TIMEOUT;
  const shown = storage.getItem(LAST_SHOWN_KEY);
  return !shown || now - parseInt(shown, 10) > SHOWN_TIMEOUT;
}

export const markLocationPromptShown = (storage: Store, now: number) => storage.setItem(LAST_SHOWN_KEY, String(now));
export const markLocationPromptSkipped = (storage: Store, now: number) => storage.setItem(LAST_SKIPPED_KEY, String(now));
