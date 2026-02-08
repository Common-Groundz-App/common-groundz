import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark';
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: TurnstileOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  appearance?: 'always' | 'execute' | 'interaction-only';
}

const scheduleIdle = (cb: () => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(cb);
  } else {
    setTimeout(cb, 150);
  }
};

const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  onVerify,
  onError,
  onExpire,
  theme = 'light',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);

  const initWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
      return;
    }

    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      console.error('VITE_TURNSTILE_SITE_KEY not configured');
      return;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'error-callback': onError,
        'expired-callback': onExpire,
        theme: theme,
        size: 'flexible',
        appearance: 'interaction-only',
      });
      console.log('Turnstile widget initialized');
    } catch (error) {
      console.error('Turnstile render error:', error);
    }
  }, [onVerify, onError, onExpire]);

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      scheduleIdle(initWidget);
      return;
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript && !scriptLoadedRef.current) {
      const checkInterval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(checkInterval);
          scheduleIdle(initWidget);
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }

    if (!existingScript) {
      scriptLoadedRef.current = true;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        scheduleIdle(initWidget);
      };

      script.onerror = () => {
        console.error('Failed to load Turnstile script');
        onError?.();
      };

      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Widget may already be removed
        }
        widgetIdRef.current = null;
      }
    };
  }, [initWidget, onError]);

  // Re-initialize if callbacks change
  useEffect(() => {
    if (window.turnstile && containerRef.current && !widgetIdRef.current) {
      scheduleIdle(initWidget);
    }
  }, [initWidget]);

  const container = <div ref={containerRef} className="turnstile-container" />;

  // Portal into #turnstile-root if available, otherwise render in-place with hidden fallback
  const portalTarget = document.getElementById('turnstile-root');
  if (portalTarget) {
    return createPortal(container, portalTarget);
  }

  return <div ref={containerRef} className="turnstile-container [&:empty]:hidden" />;
};

export default TurnstileWidget;
