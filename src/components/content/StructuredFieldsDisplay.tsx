import * as React from 'react';
import { ThumbsUp, ThumbsDown, Clock, Users, RefreshCw } from 'lucide-react';
import { hasStructuredContent, ALLOWED_STRUCTURED_KEYS, DURATION_OPTIONS } from '@/types/structuredFields';

interface StructuredFieldsDisplayProps {
  data: Record<string, any>;
}

const StructuredFieldsDisplay: React.FC<StructuredFieldsDisplayProps> = ({ data }) => {
  if (!data || typeof data !== 'object' || !hasStructuredContent(data)) return null;

  // Only render allowed keys
  const safeData: Record<string, any> = {};
  for (const key of ALLOWED_STRUCTURED_KEYS) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      safeData[key] = data[key];
    }
  }

  const hasNarrative = safeData.what_worked || safeData.what_didnt;
  const hasMetadata = safeData.duration || safeData.good_for || safeData.reuse_intent;

  return (
    <div className="mt-4 space-y-3">
      {/* Narrative section */}
      {hasNarrative && (
        <div className="space-y-2">
          {safeData.what_worked && (
            <div className="flex gap-2 items-start">
              <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">What worked</p>
                <p className="text-sm text-foreground">{safeData.what_worked}</p>
              </div>
            </div>
          )}
          {safeData.what_didnt && (
            <div className="flex gap-2 items-start">
              <ThumbsDown className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">What didn't work</p>
                <p className="text-sm text-foreground">{safeData.what_didnt}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata row */}
      {hasMetadata && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {safeData.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {DURATION_OPTIONS[safeData.duration] || safeData.duration}
            </span>
          )}
          {safeData.good_for && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {safeData.good_for}
            </span>
          )}
          {safeData.reuse_intent && (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" />
              {safeData.reuse_intent === 'yes' ? 'Would use again' : 'Would not use again'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StructuredFieldsDisplay;
