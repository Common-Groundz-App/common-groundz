
import { Howl } from 'howler';

// Types for haptic feedback
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection';

// Cache for loaded sounds to avoid reloading
const soundCache = new Map<string, Howl>();

/**
 * Triggers haptic feedback on supported devices
 * Uses the Vibration API for mobile web browsers
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  try {
    // Check if vibration API is supported
    if (!navigator.vibrate) {
      return;
    }

    // Map haptic types to vibration patterns (in milliseconds)
    const vibrationPatterns: Record<HapticType, number | number[]> = {
      light: 10,      // Very light tap
      selection: 20,  // Light selection feedback
      medium: 40,     // Medium feedback
      heavy: [50, 30, 50] // Heavy with pattern
    };

    const pattern = vibrationPatterns[type];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if haptic feedback is not available
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Plays a sound using Howler.js
 * Caches sounds for better performance
 */
export const playSound = (soundPath: string): void => {
  try {
    // Check if sound is already cached
    let sound = soundCache.get(soundPath);
    
    if (!sound) {
      // Create new Howl instance
      sound = new Howl({
        src: [soundPath],
        volume: 0.3, // Keep volume moderate
        preload: true,
        onloaderror: (id, error) => {
          console.debug('Sound loading error:', error);
        }
      });
      
      // Cache the sound
      soundCache.set(soundPath, sound);
    }

    // Play the sound
    sound.play();
  } catch (error) {
    // Silently fail if audio is not available
    console.debug('Audio playback failed:', error);
  }
};

/**
 * Combined feedback function for convenience
 * Triggers both haptic and sound feedback
 */
export const triggerFeedback = (hapticType: HapticType, soundPath: string): void => {
  triggerHaptic(hapticType);
  playSound(soundPath);
};

// Predefined feedback actions for common interactions
export const feedbackActions = {
  like: () => triggerFeedback('selection', '/sounds/like.mp3'),
  save: () => triggerFeedback('selection', '/sounds/save.mp3'),
  refresh: () => triggerFeedback('medium', '/sounds/refresh.mp3'),
  post: () => triggerFeedback('light', '/sounds/post.mp3'),
  comment: () => triggerFeedback('light', '/sounds/post.mp3')
};
