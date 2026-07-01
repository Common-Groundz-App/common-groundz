import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Entity, EntityType } from '@/services/recommendation/types';
import {
  BrandPicker,
  type BrandDecision,
  type BrandPickerHandle,
  type WebsiteConflictInfo,
} from './BrandPicker';
import { ImageCandidateGrid } from './ImageCandidateGrid';
import { ImageSelectionV2, PendingUpload } from './types';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import type { EntityDraft, BrandCandidate } from '@/types/entityDraft';
import {
  buildEntityFormPatchFromPredictions,
  type EntityFormPatch,
} from './buildEntityFormPatch';


export interface DraftApplyOverrides {
  parentOverride: Entity | null;
  metadataOverride: Record<string, any>;
  imageOverride: string | null;
  /** Phase 3.3A — multi-select gallery (remote URLs first, primary index 0). */
  galleryOverride?: string[];
  /** Phase 3.3A — local files the admin uploaded; resolved at host-form Save. */
  pendingUploads?: PendingUpload[];
  /** Phase 3.3A — primary is a local pending upload (not a remote URL). */
  primaryPending?: PendingUpload | null;
  /** Phase 3.3A — admin explicitly chose "no image". */
  noImageChosen?: boolean;
  /** Pure patch computed from predictions + urlMetadata — used by the host
   *  to prefill the form without React-state races. */
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
  /** Phase 3.2 v6 — Stage 2 "Apply to Form" handler. Hands the resolved
   *  brand + image + full patch to the host so the host's form is
   *  prefilled. The host form's own Save button is the ONLY entity
   *  write path. This modal never creates the entity. */
  onPrefillForm: (overrides: DraftApplyOverrides) => Promise<void> | void;
}

type Stage = 'brand' | 'entity';

export const DraftReviewBody: React.FC<DraftReviewBodyProps> = ({
  draft,
  onCancel,
  predictions = null,
  urlMetadata = null,
  analyzedUrl = null,
  onPrefillForm,
}) => {
  const { toast } = useToast();
  const noBrandCandidates = draft.brandCandidates.length === 0;

  // If there are no brand candidates at all (e.g. predictions.type === 'brand'),
  // skip Stage 1 entirely and go straight to entity review with
  // brand_status='not_applicable'.
  const [stage, setStage] = useState<Stage>(noBrandCandidates ? 'entity' : 'brand');
  const [brandDecision, setBrandDecision] = useState<BrandDecision | null>(
    noBrandCandidates ? { kind: 'not_applicable' } : null,
  );
  const [resolvedParent, setResolvedParent] = useState<Entity | null>(null);
  const [resolvedBrandMetadata, setResolvedBrandMetadata] = useState<Record<string, any>>({});
  const [imageSelection, setImageSelection] = useState<ImageSelectionV2>({
    primaryUrl: null,
    primaryPending: null,
    galleryUrls: [],
    galleryPending: [],
    noImageChosen: false,
  });
  const [stage1Busy, setStage1Busy] = useState(false);
  const [stage2Busy, setStage2Busy] = useState(false);
  const [websiteConflict, setWebsiteConflict] = useState<WebsiteConflictInfo | null>(null);
  const brandPickerRef = useRef<BrandPickerHandle>(null);


  // Pure patch — stable across renders unless inputs change.
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

  // ─── Stage 1: brand confirm + (optional) create ───────────────────────
  const confirmLabel =
    brandDecision?.kind === 'create_new'
      ? 'Create Brand & Continue'
      : 'Confirm Brand & Continue';

  /** Shared brand-create call. Returns the resolved Entity on success, or null
   *  if the caller should not advance (toast already shown, or conflict surfaced). */
  const createBrandViaEdgeFn = async (
    candidate: BrandCandidate,
    options: { websiteOverride?: string | null; allowWebsiteConflict?: boolean } = {},
  ): Promise<Entity | null> => {
    const websiteToSend =
      options.websiteOverride !== undefined
        ? options.websiteOverride
        : candidate.websiteUrl ?? null;
    const isManualDraftReview = candidate.source === 'admin_manual';
    const { data, error } = await supabase.functions.invoke('create-brand-entity', {
      body: {
        brandName: candidate.name,
        sourceUrl: draft.inputRef,
        logo: candidate.logoUrl ?? null,
        website: websiteToSend,
        description: candidate.reason ?? null,
        confirmCreate: true,
        ...(isManualDraftReview ? { creationContext: 'draft_review_manual' } : {}),
        ...(options.allowWebsiteConflict ? { allowWebsiteConflict: true } : {}),
      },
    });

    // Plan v3.1 — status-first branching. Conflicts must NOT be treated as success.
    if (data?.status === 'website_conflict') {
      setWebsiteConflict({
        candidate: data.candidate,
        submittedName: candidate.name,
        submittedWebsite: websiteToSend || '',
      });
      return null;
    }
    if (data?.status === 'confirm_required') {
      // Defensive — current flow always sends confirmCreate:true, but surface clearly.
      toast({
        title: 'Confirmation required',
        description: 'The brand needs explicit confirmation. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
    if (error || !data?.success || !data?.brandEntity) {
      toast({
        title: 'Brand creation failed',
        description: error?.message || 'Could not create the new brand.',
        variant: 'destructive',
      });
      return null;
    }

    const created = data.brandEntity;
    return {
      id: created.id,
      name: created.name,
      type: EntityType.Brand,
      image_url: created.image_url,
      slug: created.slug,
      description: created.description,
      website_url: created.website_url,
      metadata: created.metadata || {},
    } as unknown as Entity;
  };

  const advanceToStage2 = (parent: Entity | null, metaPatch: Record<string, any>) => {
    if (parent) delete metaPatch.brand_status;
    setResolvedParent(parent);
    setResolvedBrandMetadata(metaPatch);
    setWebsiteConflict(null);
    setStage('entity');
  };

  const handleConfirmBrand = async () => {
    if (!brandDecision || stage1Busy) return;
    setStage1Busy(true);
    setWebsiteConflict(null);
    try {
      let parent: Entity | null = null;
      const metaPatch: Record<string, any> = {};

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
          return;
        }
        parent = {
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
        const created = await createBrandViaEdgeFn(brandDecision.candidate);
        if (!created) return; // conflict or error — stay on Stage 1
        parent = created;
        toast({
          title: 'Brand created',
          description: `"${created.name}" is now in your entities.`,
        });
      } else if (brandDecision.kind === 'not_sure' || brandDecision.kind === 'not_listed') {
        metaPatch.brand_status = 'unknown';
      } else if (brandDecision.kind === 'not_applicable') {
        metaPatch.brand_status = 'not_applicable';
      }

      advanceToStage2(parent, metaPatch);
    } finally {
      setStage1Busy(false);
    }
  };

  // ─── Website-conflict actions (Plan v3.1) ─────────────────────────────
  const handleConflictClearWebsite = async () => {
    if (!websiteConflict || !brandDecision || brandDecision.kind !== 'create_new') return;
    // Clear the manual form's website field visibly.
    brandPickerRef.current?.clearManualWebsite();
    setWebsiteConflict(null);
    // Update the in-flight candidate so the retry actually sends an empty website.
    const updatedCandidate: BrandCandidate = {
      ...brandDecision.candidate,
      websiteUrl: undefined,
    };
    setBrandDecision({ kind: 'create_new', candidate: updatedCandidate });
    setStage1Busy(true);
    try {
      const created = await createBrandViaEdgeFn(updatedCandidate, { websiteOverride: null });
      if (!created) return;
      toast({ title: 'Brand created', description: `"${created.name}" is now in your entities.` });
      advanceToStage2(created, {});
    } finally {
      setStage1Busy(false);
    }
  };

  const handleConflictUseExisting = async () => {
    if (!websiteConflict) return;
    setStage1Busy(true);
    try {
      const { data: brandRow, error } = await supabase
        .from('entities')
        .select('id, name, slug, image_url, website_url, description, type, metadata, created_at, updated_at')
        .eq('id', websiteConflict.candidate.id)
        .eq('is_deleted', false)
        .maybeSingle();
      if (error || !brandRow) {
        toast({
          title: 'Brand lookup failed',
          description: 'Could not load the existing brand.',
          variant: 'destructive',
        });
        return;
      }
      const parent = {
        id: brandRow.id,
        name: brandRow.name,
        type: brandRow.type as EntityType,
        image_url: brandRow.image_url ?? undefined,
        slug: brandRow.slug ?? undefined,
        description: brandRow.description ?? undefined,
        website_url: brandRow.website_url ?? undefined,
        metadata: (brandRow.metadata as Record<string, any>) ?? {},
      } as unknown as Entity;
      // Switch the decision cleanly so any retry does NOT reuse manual creationContext.
      setBrandDecision({
        kind: 'existing',
        entityId: brandRow.id,
        candidate: {
          id: brandRow.id,
          name: brandRow.name,
          logoUrl: brandRow.image_url ?? undefined,
          websiteUrl: brandRow.website_url ?? undefined,
          source: 'existing_entity',
          confidence: 1,
          reason: 'Selected from website conflict',
          status: 'matched_existing',
        },
      });
      advanceToStage2(parent, {});
    } finally {
      setStage1Busy(false);
    }
  };

  const handleConflictCreateAnyway = async () => {
    if (!websiteConflict || !brandDecision || brandDecision.kind !== 'create_new') return;
    setStage1Busy(true);
    try {
      // Plan v3.2 — defense-in-depth: also null the website in the retry payload
      // so the backend never sees the conflicting URL.
      const created = await createBrandViaEdgeFn(brandDecision.candidate, {
        allowWebsiteConflict: true,
        websiteOverride: null,
      });
      if (!created) return;
      toast({
        title: 'Brand created without website',
        description: `"${created.name}" was created. Website was left empty to avoid a conflict — you can add one later.`,
      });
      advanceToStage2(created, {});
    } finally {
      setStage1Busy(false);
    }
  };



  // ─── Stage 2: prefill the host form ───────────────────────────────────
  const handlePrefill = async () => {
    if (stage2Busy) return;
    setStage2Busy(true);
    try {
      const finalPatch: EntityFormPatch = { ...baseFormPatch };

      // Resolve primary: explicit selection > pending upload > default.
      let primary: string | null = null;
      if (imageSelection.noImageChosen) {
        primary = null;
        delete finalPatch.image_url;
      } else if (imageSelection.primaryPending) {
        primary = imageSelection.primaryPending.previewUrl; // blob:, host swaps on Save
      } else {
        primary =
          imageSelection.primaryUrl ??
          draft.imageCandidates[draft.recommendedImageIndex ?? 0]?.url ??
          baseFormPatch.image_url ??
          null;
      }
      if (primary && !imageSelection.noImageChosen) finalPatch.image_url = primary;

      await onPrefillForm({
        parentOverride: resolvedParent,
        metadataOverride: resolvedBrandMetadata,
        imageOverride: imageSelection.noImageChosen ? null : primary,
        galleryOverride: imageSelection.noImageChosen ? [] : imageSelection.galleryUrls,
        pendingUploads: imageSelection.noImageChosen ? [] : imageSelection.galleryPending,
        primaryPending: imageSelection.noImageChosen ? null : imageSelection.primaryPending,
        noImageChosen: imageSelection.noImageChosen,
        formPatch: finalPatch,
        tagsOverride: finalPatch.tags,
      });
    } finally {
      setStage2Busy(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (stage === 'brand') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Step 1 of 2 — Confirm the brand for this entity.
        </div>

        <BrandPicker
          ref={brandPickerRef}
          candidates={draft.brandCandidates}
          recommendedIndex={draft.recommendedBrandIndex}
          value={brandDecision}
          onChange={(d) => {
            setBrandDecision(d);
            // Any change in decision invalidates a stale conflict alert.
            if (websiteConflict) setWebsiteConflict(null);
          }}
          websiteConflict={websiteConflict}
          onClearWebsite={handleConflictClearWebsite}
          onUseExistingFromConflict={handleConflictUseExisting}
          onCreateAnyway={handleConflictCreateAnyway}
        />


        {brandDecision?.kind === 'create_new' && (
          <p className="text-xs text-muted-foreground">
            This will create the brand now. You can still cancel entity creation later.
          </p>
        )}

        {draft.warnings && draft.warnings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {draft.warnings.join(' · ')}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} disabled={stage1Busy}>
            Cancel
          </Button>
          <Button onClick={handleConfirmBrand} disabled={!brandDecision || stage1Busy || !!websiteConflict}>
            {stage1Busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    );
  }

  // Stage 2 — entity review + primary image
  const nameDisplay = baseFormPatch.name ?? draft.nameGuess ?? '';
  const typeDisplay = baseFormPatch.type ?? draft.typeGuess ?? '';
  const categoryDisplay = draft.categoryHint?.path ?? '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Step 2 of 2 — Review entity details and pick the primary image.
        </div>
        {!noBrandCandidates && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStage('brand')}
            disabled={stage2Busy}
            className="h-7 px-2"
          >
            <ArrowLeft className="h-3 w-3 mr-1" /> Back
          </Button>
        )}
      </div>

      <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
        {nameDisplay && (
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
            <p className="text-sm font-medium">{nameDisplay}</p>
          </div>
        )}
        {typeDisplay && (
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
            <p className="text-sm">{getEntityTypeLabel(typeDisplay)}</p>
          </div>
        )}
        {categoryDisplay && (
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Category</Label>
            <p className="text-sm">{categoryDisplay}</p>
          </div>
        )}
        {resolvedParent ? (
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand</Label>
            <p className="text-sm">{resolvedParent.name}</p>
          </div>
        ) : resolvedBrandMetadata.brand_status ? (
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand</Label>
            <p className="text-sm text-muted-foreground italic">
              {resolvedBrandMetadata.brand_status === 'not_applicable' ? 'Not applicable' : 'Unknown'}
            </p>
          </div>
        ) : null}
      </div>

      <ImageCandidateGrid
        candidates={draft.imageCandidates}
        recommendedIndex={draft.recommendedImageIndex}
        value={imageSelection}
        onChange={setImageSelection}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={stage2Busy}>
          Cancel
        </Button>
        <Button onClick={handlePrefill} disabled={stage2Busy}>
          {stage2Busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Apply to Form
        </Button>
      </div>
    </div>
  );
};
