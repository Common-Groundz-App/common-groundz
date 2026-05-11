import { useEffect, useRef, RefObject } from 'react';
import { analytics } from '@/services/analytics';

const MILESTONES: Array<25 | 50 | 75 | 100> = [25, 50, 75, 100];

/**
 * Emits video_progress events at 25/50/75/100% (each at most once per
 * <video> instance) and video_completed at 100%.
 *
 * Throttled internally via timeupdate (which fires ~4×/s in most browsers).
 */
export function useVideoMilestones(
  videoRef: RefObject<HTMLVideoElement>,
  meta: { src?: string; autoplayRef: RefObject<boolean> }
) {
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      const dur = el.duration;
      if (!dur || !isFinite(dur) || dur <= 0) return;
      const pct = (el.currentTime / dur) * 100;

      for (const m of MILESTONES) {
        if (pct >= m && !firedRef.current.has(m)) {
          firedRef.current.add(m);
          analytics.trackVideoProgress({
            src: meta.src,
            duration: dur,
            milestone: m,
            autoplay: meta.autoplayRef.current ?? false,
          });
          if (m === 100) {
            analytics.trackVideoCompleted({
              src: meta.src,
              duration: dur,
              autoplay: meta.autoplayRef.current ?? false,
            });
          }
        }
      }
    };

    // When a looping video crosses back to 0, allow milestones to re-fire on the next loop.
    const onSeeked = () => {
      if (el.currentTime < 1) firedRef.current.clear();
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('seeked', onSeeked);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('seeked', onSeeked);
    };
  }, [videoRef, meta.src, meta.autoplayRef]);
}
