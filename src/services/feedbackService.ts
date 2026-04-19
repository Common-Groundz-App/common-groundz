
import { Howl, Howler } from 'howler';

// Types for haptic feedback
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection';

// Cache for loaded sounds to avoid reloading
const soundCache = new Map<string, Howl>();

// ---------------------------------------------------------------------------
// Audio unlock — many browsers (esp. iOS Safari, mobile Chrome) suspend the
// AudioContext until a user gesture occurs. We resume it on the very first
// pointerdown so subsequent programmatic plays (post submit, like, etc.)
// actually produce sound. Runs once per page load.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      // Howler v2 exposes the shared AudioContext on its singleton.
      const ctx = (Howler as any).ctx as AudioContext | undefined;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch((err) => {
          console.warn('AudioContext resume failed:', err);
        });
      }
    } catch (err) {
      console.warn('Audio unlock failed:', err);
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
}

/**
 * Triggers haptic feedback if supported
 * Uses navigator.vibrate() for mobile web browsers
 */
export const triggerHaptic = (type: HapticType): void => {
  try {
    // Check if vibration API is supported
    if (!navigator.vibrate) {
      console.log('Haptic feedback not supported on this device');
      return;
    }

    // Map haptic types to vibration patterns (in milliseconds)
    const vibrationPatterns: Record<HapticType, number | number[]> = {
      light: 50,
      medium: 100,
      heavy: 200,
      selection: [25, 25, 25] // Triple tap pattern
    };

    const pattern = vibrationPatterns[type];
    navigator.vibrate(pattern);
    
    console.log(`Haptic feedback triggered: ${type}`);
  } catch (error) {
    console.error('Error triggering haptic feedback:', error);
  }
};

/**
 * Plays a sound effect using Howler.js
 * @param src - Path to the sound file
 * @param volume - Optional volume override (0.0 to 1.0). Defaults to 0.3.
 */
export const playSound = (src: string, volume: number = 0.3): void => {
  try {
    // Check if we already have this sound cached
    let sound = soundCache.get(src);
    
    if (!sound) {
      // Create new Howl instance
      sound = new Howl({
        src: [src],
        volume,
        preload: true,
        html5: true, // Use HTML5 Audio for better mobile support
        onloaderror: (id, error) => {
          console.error(`Failed to load sound: ${src}`, error);
        },
        onplayerror: (id, error) => {
          console.error(`Failed to play sound: ${src}`, error);
        }
      });
      
      // Cache the sound for future use
      soundCache.set(src, sound);
    } else {
      // Update volume on cached instance for this play
      sound.volume(volume);
    }

    // Play the sound
    sound.play();
    console.log(`Sound played: ${src} @ ${volume}`);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

/**
 * Combined feedback function for common interactions
 */
export const triggerFeedback = (
  hapticType: HapticType,
  soundSrc: string,
  volume: number = 0.3
): void => {
  triggerHaptic(hapticType);
  playSound(soundSrc, volume);
};

/**
 * Preload common sounds for better performance
 */
export const preloadSounds = (): void => {
  const commonSounds = [
    '/sounds/post.wav',
    '/sounds/signin.wav',
    '/sounds/signup.wav',
    '/sounds/logout.wav'
  ];

  commonSounds.forEach(src => {
    if (!soundCache.has(src)) {
      try {
        const sound = new Howl({
          src: [src],
          volume: 0.3,
          preload: true,
          html5: true
        });
        soundCache.set(src, sound);
      } catch (error) {
        console.error(`Failed to preload sound: ${src}`, error);
      }
    }
  });

  console.log('Common sounds preloaded');
};

// Quieter volume for auth feedback — gentle confirmation, not a notification
const AUTH_VOLUME = 0.15;

// Predefined feedback combinations for common actions
export const feedbackActions = {
  // Content creation — standard volume, satisfying confirmation
  post: () => triggerFeedback('light', '/sounds/post.wav'),
  // Comments share the same sound as posts (both are "user posting" actions)
  comment: () => triggerFeedback('light', '/sounds/post.wav'),

  // Auth — quieter, subtle confirmation
  signin: () => triggerFeedback('light', '/sounds/signin.wav', AUTH_VOLUME),
  signup: () => triggerFeedback('light', '/sounds/signup.wav', AUTH_VOLUME),
  logout: () => triggerFeedback('light', '/sounds/logout.wav', AUTH_VOLUME),

  // Like / save — haptic only (no sound, modern apps removed these)
  like: () => triggerHaptic('selection'),
  save: () => triggerHaptic('selection'),
};

// ---------------------------------------------------------------------------
// Deferred signin sound — for flows like Google OAuth where we return to the
// app via redirect (no fresh user gesture). Browsers (esp. iOS Safari/Chrome)
// require a post-load gesture to unlock audio, so we wait for the next
// pointerdown before playing the signin sound.
// ---------------------------------------------------------------------------
let pendingSigninHandler: (() => void) | null = null;

export function playSigninAfterInteraction(): void {
  // Cancel any previously queued signin sound (prevents double-fire if the
  // user signs in, signs out, and signs in again before tapping).
  if (pendingSigninHandler) {
    window.removeEventListener('pointerdown', pendingSigninHandler);
    pendingSigninHandler = null;
  }

  const handler = () => {
    pendingSigninHandler = null;
    try { feedbackActions.signin(); } catch {}
  };

  pendingSigninHandler = handler;
  window.addEventListener('pointerdown', handler, { once: true, passive: true });
}
