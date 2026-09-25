import React, { useState } from 'react';
import { ImageFailedState } from '@/components/common/ImageFailedState';

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

  return (
    <ImageFailedState
      name={name}
      className={className}
      iconClassName={iconClassName}
      variant={state}
      testId={`evidence-image-${state}`}
    />
  );
};
