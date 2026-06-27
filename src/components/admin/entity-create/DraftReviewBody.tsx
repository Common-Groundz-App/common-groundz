import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from '@/services/recommendation/types';
import { BrandPicker, BrandDecision } from './BrandPicker';
import { ImageCandidateGrid, ImageSelection } from './ImageCandidateGrid';
import type { EntityDraft } from '@/types/entityDraft';
import {
  buildEntityFormPatchFromPredictions,
  type EntityFormPatch,
} from './buildEntityFormPatch';

export interface DraftApplyOverrides {
  parentOverride: Entity | null;
  metadataOverride: Record<string, any>;
  imageOverride: string | null;
  /** Phase 3.2 bugfix — full-field patch computed from predictions +
   *  urlMetadata so handleSubmit can validate & insert without relying on
   *  React state catching up. */
  formPatch: EntityFormPatch;
  /** Tags live outside formData in the host dialog; shipped explicitly. */
  tagsOverride?: string[];
}

interface DraftReviewBodyProps {
  draft: EntityDraft;
  onCancel: () => void;
  /** Raw V2 predictions object — used by the pure patch builder. */
  predictions?: any | null;
  /** Lightweight metadata payload from fetch-url-metadata-lite. */
  urlMetadata?: any | null;
  /** Analyzed-URL snapshot captured at modal open. */
  analyzedUrl?: string | null;
  /** Called once the user clicks Apply & Save. Translates the draft
   *  decisions into explicit overrides that the host's handleSubmit
   *  consumes directly — never via React state. */
  onApply: (overrides: DraftApplyOverrides) => Promise<void> | void;
}

export const DraftReviewBody: React.FC<DraftReviewBodyProps> = ({
  draft,
  onCancel,
  predictions = null,
  urlMetadata = null,
  analyzedUrl = null,
  onApply,
}) => {
  const { toast } = useToast();
  const [brandDecision, setBrandDecision] = useState<BrandDecision | null>(() => {
    if (draft.brandCandidates.length === 0) {
      return { kind: 'not_applicable' };
    }
    return null;
  });
  const [imageSelection, setImageSelection] = useState<ImageSelection>({
    primaryUrl: null,
    galleryUrls: [],
  });
  const [submitting, setSubmitting] = useState(false);

  // Precompute the pure patch once. Stable across renders unless inputs
  // change — guarantees DraftReviewBody never reads live React state.
  const baseFormPatch = useMemo<EntityFormPatch>(
    () =>
      buildEntityFormPatchFromPredictions({
        predictions: predictions ?? {
          name: draft.nameGuess,
          type: draft.typeGuess,
          description: draft.descriptionGuess,
          category_id: draft.categoryHint?.id,
          matched_category_name: draft.categoryHint?.path,
          additional_data: draft.structuredHints,
        },
        urlMetadata,
        analyzedUrl,
      }),
    [predictions, urlMetadata, analyzedUrl, draft],
  );

  const canApply = useMemo(() => {
    if (!brandDecision) return false;
    return true;
  }, [brandDecision]);

  const handleApplyClick = async () => {
    if (!brandDecision || submitting) return;
    setSubmitting(true);
    try {
      let parentOverride: Entity | null = null;
      const metadataOverride: Record<string, any> = {};

      // Resolve parent from BrandDecision. Never read React state — always
      // pass through the explicit overrides object so handleSubmit cannot
      // race the next render.
      if (brandDecision.kind === 'existing') {
        const { data: brandRow, error } = await supabase
          .from('entities')
          .select('id, name, slug, image_url, website_url, description, type, metadata, created_at, updated_at')
          .eq('id', brandDecision.entityId)
          .eq('is_deleted', false)
          .maybeSingle();
        if (error || !brandRow) {
          toast({
            title: 'Brand lookup failed',
            description: 'Could not load the selected brand. Please try again.',
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }
        parentOverride = {
          id: brandRow.id,
          name: brandRow.name,
          type: brandRow.type as EntityType,
          image_url: brandRow.image_url ?? undefined,
          slug: brandRow.slug ?? undefined,
          description: brandRow.description ?? undefined,
          website_url: brandRow.website_url ?? undefined,
          metadata: (brandRow.metadata as Record<string, any>) ?? {},
        } as unknown as Entity;
      } else if (brandDecision.kind === 'create_new') {
        // confirmCreate: true → admin already explicitly confirmed in BrandPicker.
        const { data, error } = await supabase.functions.invoke('create-brand-entity', {
          body: {
            brandName: brandDecision.candidate.name,
            sourceUrl: draft.inputRef,
            logo: brandDecision.candidate.logoUrl ?? null,
            website: brandDecision.candidate.websiteUrl ?? null,
            description: brandDecision.candidate.reason ?? null,
            confirmCreate: true,
          },
        });
        if (error || !data?.brandEntity) {
          toast({
            title: 'Brand creation failed',
            description: error?.message || 'Could not create the new brand.',
            variant: 'destructive',
          });
          setSubmitting(false);
          return;
        }
        const created = data.brandEntity;
        parentOverride = {
          id: created.id,
          name: created.name,
          type: EntityType.Brand,
          image_url: created.image_url,
          slug: created.slug,
          description: created.description,
          website_url: created.website_url,
          metadata: created.metadata || {},
        } as unknown as Entity;
      } else if (brandDecision.kind === 'not_sure' || brandDecision.kind === 'not_listed') {
        metadataOverride.brand_status = 'unknown';
      } else if (brandDecision.kind === 'not_applicable') {
        metadataOverride.brand_status = 'not_applicable';
      }

      // brand_status is only stored when no parent is set; if a parent is
      // resolved, drop the field outright so a row can never carry both.
      if (parentOverride) {
        delete metadataOverride.brand_status;
      }

      // Compose the final patch — primary image override wins over patch.
      const finalPatch: EntityFormPatch = { ...baseFormPatch };
      if (imageSelection.primaryUrl) {
        finalPatch.image_url = imageSelection.primaryUrl;
      }

      await onApply({
        parentOverride,
        metadataOverride,
        imageOverride: imageSelection.primaryUrl ?? finalPatch.image_url ?? null,
        formPatch: finalPatch,
        tagsOverride: finalPatch.tags,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        Review the draft below. Brand and image selections are explicit — no
        silent auto-creation.
      </div>

      {(baseFormPatch.name || draft.nameGuess) && (
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Name (suggested)
          </Label>
          <p className="text-sm font-medium">{baseFormPatch.name ?? draft.nameGuess}</p>
        </div>
      )}

      <BrandPicker
        candidates={draft.brandCandidates}
        recommendedIndex={draft.recommendedBrandIndex}
        value={brandDecision}
        onChange={setBrandDecision}
      />

      <ImageCandidateGrid
        candidates={draft.imageCandidates}
        recommendedIndex={draft.recommendedImageIndex}
        value={imageSelection}
        onChange={setImageSelection}
      />

      {draft.warnings && draft.warnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {draft.warnings.join(' · ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleApplyClick} disabled={!canApply || submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Apply & Save
        </Button>
      </div>
    </div>
  );
};
