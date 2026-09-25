import React, { useEffect, useRef, useState } from 'react';
import { ensureHttps } from '@/utils/urlUtils';
import { getProxyUrlForImage } from '@/utils/imageUtils';

/**
 * Generic picture helper for NON-entity imagery (profile cover, location
 * photos, admin search/auto-fill/candidate previews).
 *
 * Post-6 Step 2 contract:
 *  - no built-in stock photo and no type-based stock lookup;
 *  - a remote http/https source that goes through our relay gets exactly one
 *    direct retry if the relay fails;
 *  - a caller-supplied `fallbackSrc` is tried at most once, never looped,
 *    and skipped if equivalent to the primary;
 *  - terminal failure renders `failedContent` (or nothing);
 *  - `onError` fires once for the terminal primary browser failure only;
 *    `onFailure` fires once per primary lifecycle ('load' | 'invalid').
 */

const DEBUG_IMAGES = import.meta.env.DEV && import.meta.env.VITE_DEBUG_IMAGES === 'true';

interface ImageWithFallbackProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
  fallbackSrc?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onFailure?: (reason: 'load' | 'invalid') => void;
  failedContent?: React.ReactNode;
  suppressConsoleErrors?: boolean;
}

const normalize = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const isRemote = (url: string) => /^https?:\/\//i.test(url);

/** Local rule: which src values may be rendered. */
export const isRenderableImageSrc = (url: string): boolean => {
  if (!url) return false;
  if (url.startsWith('/')) return !url.startsWith('//');
  if (/^blob:/i.test(url)) return true;
  if (/^data:/i.test(url)) return /^data:image\//i.test(url);
  if (isRemote(url)) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const directUrl = (url: string) => (isRemote(url) ? ensureHttps(url) : url);
const firstUrl = (url: string) => (isRemote(url) ? getProxyUrlForImage(ensureHttps(url)) : url);

const shouldUseCors = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname;
    return ['supabase.co', 'uyjtgybbktgapspodajy', 'images.unsplash.com', 'localhost'].some((d) =>
      hostname.includes(d),
    );
  } catch {
    return false;
  }
};

type Phase = 'primary' | 'direct' | 'fallback' | 'failed';

interface AttemptProps extends ImageWithFallbackProps {
  primary: string;
  fallback: string;
}

const ImageAttempt: React.FC<AttemptProps> = ({
  primary,
  fallback,
  alt,
  onError,
  onFailure,
  failedContent,
  suppressConsoleErrors,
  src: _src,
  fallbackSrc: _fallbackSrc,
  ...imgProps
}) => {
  const primaryValid = isRenderableImageSrc(primary);
  const fallbackValid = isRenderableImageSrc(fallback);
  const primaryFirst = primaryValid ? firstUrl(primary) : '';
  const primaryDirect = primaryValid ? directUrl(primary) : '';
  const fallbackUrl = fallbackValid ? directUrl(fallback) : '';
  const fallbackUsable =
    fallbackValid &&
    fallbackUrl !== primaryFirst &&
    fallbackUrl !== primaryDirect &&
    firstUrl(fallback) !== primaryFirst;

  const initialPhase: Phase = primaryValid ? 'primary' : fallbackUsable ? 'fallback' : 'failed';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const mounted = useRef(true);
  const failureSent = useRef(false);

  const sendFailure = (reason: 'load' | 'invalid') => {
    if (failureSent.current) return;
    failureSent.current = true;
    onFailure?.(reason);
  };

  useEffect(() => {
    mounted.current = true;
    if (primary && !primaryValid) sendFailure('invalid');
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!mounted.current) return;
    if (phase === 'primary' && primaryFirst !== primaryDirect) {
      if (DEBUG_IMAGES && !suppressConsoleErrors) console.log('ImageWithFallback: relay failed, trying direct', primaryDirect);
      setPhase('direct');
      return;
    }
    if (phase === 'primary' || phase === 'direct') {
      if (!failureSent.current) onError?.(e);
      sendFailure('load');
      setPhase(fallbackUsable ? 'fallback' : 'failed');
      return;
    }
    setPhase('failed');
  };

  if (phase === 'failed') {
    return primary || fallback ? <>{failedContent ?? null}</> : null;
  }

  const url = phase === 'primary' ? primaryFirst : phase === 'direct' ? primaryDirect : fallbackUrl;
  return (
    <img
      src={url}
      alt={alt}
      onError={handleError}
      crossOrigin={shouldUseCors(url) ? 'anonymous' : undefined}
      {...imgProps}
    />
  );
};

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = (props) => {
  const primary = normalize(props.src);
  const fallback = normalize(props.fallbackSrc);
  const lifecycleKey = JSON.stringify([primary, fallback]);
  return <ImageAttempt key={lifecycleKey} {...props} primary={primary} fallback={fallback} />;
};
