
import { Howl } from 'howler';

// Types for haptic feedback
export type HapticType = 'light' | 'medium' | 'heavy' | 'selection';

// Cache for loaded sounds to avoid reloading
const soundCache = new Map<string, Howl>();

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
 */
export const playSound = (src: string): void => {
  try {
    // Check if we already have this sound cached
    let sound = soundCache.get(src);
    
    if (!sound) {
      // Create new Howl instance
      sound = new Howl({
        src: [src],
        volume: 0.3, // Keep volume moderate
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
    }

    // Play the sound
    sound.play();
    console.log(`Sound played: ${src}`);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

/**
 * Combined feedback function for common interactions
 */
export const triggerFeedback = (hapticType: HapticType, soundSrc: string): void => {
  triggerHaptic(hapticType);
  playSound(soundSrc);
};

/**
 * Preload common sounds for better performance
 */
export const preloadSounds = (): void => {
  const commonSounds = [
    '/sounds/like.mp3',
    '/sounds/refresh.mp3',
    '/sounds/post.mp3',
    '/sounds/save.mp3'
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

// Predefined feedback combinations for common actions
export const feedbackActions = {
  like: () => triggerFeedback('selection', '/sounds/like.mp3'),
  save: () => triggerFeedback('selection', '/sounds/save.mp3'),
  post: () => triggerFeedback('light', '/sounds/post.mp3'),
  refresh: () => triggerFeedback('medium', '/sounds/refresh.mp3'),
  comment: () => triggerFeedback('light', '/sounds/post.mp3')
};
