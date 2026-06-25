import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import type { ImageCandidate } from '@/types/entityDraft';

export interface ImageSelection {
  primaryUrl: string | null;
  galleryUrls: string[]; // Phase 3.2: always [] (gallery disabled).
}

interface ImageCandidateGridProps {
  candidates: ImageCandidate[];
  recommendedIndex?: number;
  value: ImageSelection;
  onChange: (next: ImageSelection) => void;
}

export const ImageCandidateGrid: React.FC<ImageCandidateGridProps> = ({
  candidates,
  recommendedIndex,
  value,
  onChange,
}) => {
  React.useEffect(() => {
    if (!value.primaryUrl && typeof recommendedIndex === 'number' && candidates[recommendedIndex]) {
      onChange({
        primaryUrl: candidates[recommendedIndex].url,
        galleryUrls: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (candidates.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Image</Label>
        <p className="text-sm text-muted-foreground">No image candidates found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Image ({candidates.length})
      </Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {candidates.map((cand, idx) => {
          const isPrimary = value.primaryUrl === cand.url;
          const isRecommended = recommendedIndex === idx;
          return (
            <div
              key={`${cand.url}-${idx}`}
              className={cn(
                'relative group rounded-md overflow-hidden border-2 cursor-pointer transition-all',
                isPrimary ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/30',
              )}
              onClick={() => onChange({ primaryUrl: cand.url, galleryUrls: [] })}
            >
              <ImageWithFallback
                src={cand.url}
                alt={`Candidate ${idx + 1}`}
                entityType="product"
                className="aspect-square w-full object-cover bg-muted"
              />
              <div className="absolute top-1 left-1 flex flex-col gap-1">
                {isPrimary && (
                  <Badge className="text-[10px] px-1.5 py-0">Primary</Badge>
                )}
                {isRecommended && !isPrimary && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    Suggested
                  </Badge>
                )}
              </div>
              <div
                className="absolute top-1 right-1 opacity-60"
                title="Gallery multi-select is disabled in this phase"
              >
                <Checkbox checked={false} disabled />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Tap a tile to set it as the primary image. Gallery multi-select is coming soon.
      </p>
    </div>
  );
};
