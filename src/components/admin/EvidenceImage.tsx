import React, { useState } from 'react';
import { ImageOff, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Group 6D — admin comparison / manual-preview picture.
 * Shows the exact supplied source and nothing else: no retry, no alternate
 * source, no stock image, no entity type icon. Three explicit states:
 * loaded → the image; failed → "Image failed to load"; missing → "No image provided".
 */
interface EvidenceImageProps {
  src: string | null | undefined;
  name: string;
  className: string;
  iconClassName?: string;
}

export const EvidenceImage: React.FC<EvidenceImageProps> = ({ src, name, className, iconClassName = 'h-5 w-5' }) => {
  const trimmed = typeof src === 'string' ? src.trim() : '';
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const state = !trimmed ? 'missing' : failedSrc === trimmed ? 'failed' : 'loaded';

  if (state === 'loaded') {
    return (
      <img
        src={trimmed}
        alt={name}
        className={className}
        onError={() => setFailedSrc(trimmed)}
        data-testid="evidence-image"
      />
    );
  }

  const text = state === 'failed' ? 'Image failed to load' : 'No image provided';
  const Icon = state === 'failed' ? ImageOff : ImageIcon;
  return (
    <span
      role="img"
      aria-label={`${text} for ${name}`}
      className={cn(className, 'flex items-center justify-center bg-muted text-muted-foreground')}
      data-testid={`evidence-image-${state}`}
    >
      <Icon className={iconClassName} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
};
