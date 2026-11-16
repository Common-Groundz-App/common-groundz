import React from 'react';
import { EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SpoilerBarrierProps {
  /** Called when the reader chooses to reveal. Reveal state lives in the caller (one per card/entry). */
  onReveal: () => void;
  /** What is being revealed; defaults to "review". Future: "update". */
  noun?: string;
  className?: string;
}

/**
 * Stand-in shown where spoiler-bearing content would be. Callers must NOT
 * mount the protected text/media while this is shown (no blur, no hidden DOM).
 */
export const SpoilerBarrier: React.FC<SpoilerBarrierProps> = ({ onReveal, noun = 'review', className }) => (
  <div
    role="note"
    aria-label={`This ${noun} contains spoilers`}
    className={cn(
      'flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/40 px-3 py-2',
      className,
    )}
  >
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      Contains spoilers
    </span>
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onReveal();
      }}
    >
      Show {noun}
    </Button>
  </div>
);

export default SpoilerBarrier;
