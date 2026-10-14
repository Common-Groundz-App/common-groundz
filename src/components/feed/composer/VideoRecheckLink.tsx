import * as React from 'react';

export const RECHECK_AFTER_MS = 90_000;

/**
 * Discreet recovery for video processing: hidden during normal processing,
 * shown after a long wait or after the connection comes back.
 */
export function VideoRecheckLink({ active }: { active: boolean }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!active) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), RECHECK_AFTER_MS);
    const onOnline = () => setShow(true);
    window.addEventListener('online', onOnline);
    return () => { clearTimeout(t); window.removeEventListener('online', onOnline); };
  }, [active]);
  if (!active || !show) return null;
  return (
    <button
      type="button"
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      onClick={() => window.dispatchEvent(new Event('mux:recheck'))}
    >
      Check again
    </button>
  );
}
