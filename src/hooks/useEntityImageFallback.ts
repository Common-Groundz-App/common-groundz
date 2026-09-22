import { useState } from 'react';
import {
  getOptimalEntityImageUrl,
  type EntityImageSource,
} from '@/utils/entityImageUtils';
import { isKnownLegacyEntityPlaceholderUrl } from '@/utils/entityImageFallback';

export const useEntityImageFallback = (
  entity: EntityImageSource | null | undefined,
) => {
  const resolvedImageUrl = getOptimalEntityImageUrl(entity);
  const imageUrl = resolvedImageUrl && !isKnownLegacyEntityPlaceholderUrl(resolvedImageUrl)
    ? resolvedImageUrl
    : null;
  const sourceKey = `${entity?.id ?? ''}:${imageUrl ?? ''}`;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const showFallback = !imageUrl || failedSourceKey === sourceKey;

  return {
    imageUrl,
    showFallback,
    markImageFailed: () => setFailedSourceKey(sourceKey),
  };
};