import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lightbulb, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

import type { EntityDraft } from '@/types/entityDraft';
import { DraftReviewBody, DraftApplyOverrides } from './entity-create/DraftReviewBody';

export interface MetadataOnlySnapshot {
  title?: string;
  websiteUrl?: string;
  images?: string[];
}

interface AutoFillPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictions: any;
  onApply: () => void;
  /**
   * Phase 2: optional metadata-only fallback snapshot. Only consumed in the
   * no-predictions branch. When non-null, the modal renders a basic metadata
   * preview and a "Use basic metadata" button. The snapshot is the exact
   * payload passed to onApplyMetadataOnly — capturing the analyzed URL at
   * render time so post-render edits to the URL input cannot poison apply.
   */
  metadataOnly?: MetadataOnlySnapshot | null;
  onApplyMetadataOnly?: (snapshot: MetadataOnlySnapshot) => void;
  /**
   * Phase 3.2: when true AND `entityDraft` is non-null, render the draft
   * review UI (BrandPicker + ImageCandidateGrid) instead of either legacy
   * branch. Gated by the admin-only `entity_extraction.review_uses_draft`
   * app_config flag.
   */
  useDraftReview?: boolean;
  entityDraft?: EntityDraft | null;
  onApplyDraft?: (overrides: DraftApplyOverrides) => Promise<void> | void;
}

interface PreviewFieldProps {
  label: string;
  value: string | string[];
  multiline?: boolean;
}

const PreviewField: React.FC<PreviewFieldProps> = ({ label, value, multiline }) => {
  if (!value || (Array.isArray(value) && value.length === 0)) return null;

  const displayValue = Array.isArray(value) ? value.join(', ') : value;

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <p className="text-sm leading-relaxed">{displayValue}</p>
      ) : (
        <p className="text-sm font-medium">{displayValue}</p>
      )}
    </div>
  );
};

// ─── Phase 8.1D: Pricing preview ─────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  extractor_jsonld_offer: 'JSON-LD Offer',
  extractor_jsonld_aggregate: 'JSON-LD AggregateOffer',
  extractor_jsonld_offers_merged_range: 'JSON-LD Offers (range)',
  extractor_jsonld_offers_selected: 'JSON-LD Offer (selected variant)',
  extractor_meta_og: 'OpenGraph',
  firecrawl_metadata: 'Firecrawl metadata',
  firecrawl_markdown_single: 'Firecrawl markdown',
  firecrawl_markdown_list_sale: 'Firecrawl markdown (MRP/Sale)',
  gemini: 'Gemini',
  unknown: 'Unknown',
  omitted: 'Omitted',
};

const fmt = (amount: unknown, currency: unknown): string | null => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (typeof currency !== 'string' || !currency.trim()) {
    return amount.toLocaleString();
  }
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

const isFiniteNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const PricingPreview: React.FC<{ pricing: any }> = ({ pricing }) => {
  if (!pricing || typeof pricing !== 'object') return null;

  const {
    price_display,
    list_price,
    sale_price,
    selected_variant_price,
    price_min,
    price_max,
    currency,
    price_source,
    price_confidence,
    price_conflict,
    range_conflict,
    gemini_observed_price,
    gemini_observed_currency,
  } = pricing;

  // Deterministic headline fallback chain
  let headline: string | null = null;
  let headlineMuted = false;
  if (typeof price_display === 'string' && price_display.trim()) {
    headline = price_display;
  } else if (isFiniteNum(selected_variant_price)) {
    headline = fmt(selected_variant_price, currency);
  } else if (isFiniteNum(price_min) && isFiniteNum(price_max)) {
    const lo = fmt(price_min, currency);
    const hi = fmt(price_max, currency);
    headline = lo && hi ? `${lo} – ${hi}` : null;
  } else if (isFiniteNum(sale_price)) {
    headline = fmt(sale_price, currency);
  }
  if (!headline) {
    if (price_conflict === true) {
      headline = 'Price omitted — conflicting sources';
      headlineMuted = true;
    } else {
      headline = '—';
      headlineMuted = true;
    }
  }

  // Secondary rows
  const showPair = isFiniteNum(list_price) && isFiniteNum(sale_price);
  const showRange =
    isFiniteNum(price_min) && isFiniteNum(price_max) && price_min !== price_max;
  const showSelected = isFiniteNum(selected_variant_price);

  // Primary numeric for Gemini comparison
  let primaryNumeric: number | null = null;
  if (isFiniteNum(selected_variant_price)) primaryNumeric = selected_variant_price;
  else if (isFiniteNum(sale_price)) primaryNumeric = sale_price;
  else if (isFiniteNum(price_min) && isFiniteNum(price_max) && price_min === price_max)
    primaryNumeric = price_min;

  const showGemini =
    isFiniteNum(gemini_observed_price) &&
    (primaryNumeric === null || gemini_observed_price !== primaryNumeric);

  const sourceLabel =
    typeof price_source === 'string'
      ? SOURCE_LABELS[price_source] ?? price_source
      : null;

  return (
    <div className="space-y-2 pt-2 border-t">
      <Label className="text-xs text-muted-foreground">Pricing</Label>

      <p
        className={`text-lg font-medium ${headlineMuted ? 'text-muted-foreground' : ''}`}
      >
        {headline}
      </p>

      {showPair && (
        <p className="text-xs text-muted-foreground">
          List {fmt(list_price, currency)} • Sale {fmt(sale_price, currency)}
        </p>
      )}

      {showRange && (
        <p className="text-xs text-muted-foreground">
          {fmt(price_min, currency)} – {fmt(price_max, currency)}
        </p>
      )}

      {showSelected && (
        <p className="text-xs text-muted-foreground">
          Selected variant: {fmt(selected_variant_price, currency)}
        </p>
      )}

      {(sourceLabel || isFiniteNum(price_confidence)) && (
        <div className="flex items-center gap-2">
          {sourceLabel && (
            <Badge variant="secondary" className="text-xs">
              {sourceLabel}
            </Badge>
          )}
          {isFiniteNum(price_confidence) && (
            <span className="text-xs text-muted-foreground">
              {Math.round(price_confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}

      {price_conflict === true && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Price conflict</AlertTitle>
          <AlertDescription className="text-xs">
            <code>additional_data.price</code> omitted.
          </AlertDescription>
        </Alert>
      )}

      {range_conflict === true && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Range conflict</AlertTitle>
          <AlertDescription className="text-xs">
            Mixed-currency offers — no public range.
          </AlertDescription>
        </Alert>
      )}

      {showGemini && (
        <p className="text-xs text-muted-foreground italic">
          Gemini observed:{' '}
          {fmt(gemini_observed_price, gemini_observed_currency ?? currency) ??
            String(gemini_observed_price)}
        </p>
      )}
    </div>
  );
};

export const AutoFillPreviewModal: React.FC<AutoFillPreviewModalProps> = ({
  open,
  onOpenChange,
  predictions,
  onApply,
  metadataOnly = null,
  onApplyMetadataOnly,
  useDraftReview = false,
  entityDraft = null,
  onApplyDraft,
}) => {
  // Request ID is surfaced from V2 success metadata or error envelope.
  const requestId: string | null =
    predictions?.metadata?.request_id ??
    predictions?.request_id ??
    null;

  // Phase 3.2 — admin draft-driven review branch. Takes precedence over
  // legacy success/metadata-only branches when the flag is on and a draft
  // is attached. Never renders during normal operation for non-admins.
  if (useDraftReview && entityDraft && onApplyDraft) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Review draft
            </DialogTitle>
            <DialogDescription>
              Confirm the brand and primary image before saving.
            </DialogDescription>
          </DialogHeader>
          <DraftReviewBody
            draft={entityDraft}
            onCancel={() => onOpenChange(false)}
            onApply={async (overrides) => {
              await onApplyDraft(overrides);
              onOpenChange(false);
            }}
          />
          {requestId && (
            <p className="text-xs text-muted-foreground break-all pt-2">
              Request ID: <span className="font-mono">{requestId}</span>
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // No predictions available → render inline failure state. When Phase 2
  // metadata-only data exists, surface a basic preview + "Use basic metadata"
  // action; otherwise keep the original Close-only state.
  if (!predictions?.predictions) {
    const hasMetadataOnly =
      !!metadataOnly &&
      (
        (typeof metadataOnly.title === 'string' && metadataOnly.title.trim().length > 0) ||
        (Array.isArray(metadataOnly.images) && metadataOnly.images.length > 0)
      );

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              AI details unavailable
            </DialogTitle>
            <DialogDescription>
              {hasMetadataOnly
                ? 'We found basic URL metadata that can help start the form. Please review and complete the remaining fields.'
                : "AI couldn't extract reliable details from this URL. You can fill the form manually or try again."}
            </DialogDescription>
          </DialogHeader>

          {hasMetadataOnly && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 min-w-0 overflow-hidden max-w-full">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Metadata preview
              </p>
              {metadataOnly!.title && (
                <div className="space-y-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <p className="text-sm font-medium break-words">{metadataOnly!.title}</p>
                </div>
              )}
              {metadataOnly!.websiteUrl && (
                <div className="space-y-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Website URL</Label>
                  <p
                    className="text-xs font-mono truncate text-muted-foreground"
                    title={metadataOnly!.websiteUrl}
                  >
                    {metadataOnly!.websiteUrl}
                  </p>
                </div>
              )}
              {Array.isArray(metadataOnly!.images) && metadataOnly!.images.length > 0 && (
                <div className="space-y-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">
                    Images ({metadataOnly!.images.length})
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {metadataOnly!.images.slice(0, 4).map((src, i) => (
                      <ImageWithFallback
                        key={`${src}-${i}`}
                        src={src}
                        alt={metadataOnly!.title || `Metadata image ${i + 1}`}
                        entityType="product"
                        className="aspect-square w-full rounded object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {requestId && (
            <p className="text-xs text-muted-foreground break-all">
              Request ID: <span className="font-mono">{requestId}</span>
            </p>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {hasMetadataOnly && onApplyMetadataOnly && (
              <Button onClick={() => onApplyMetadataOnly(metadataOnly!)}>
                Use basic metadata
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }


  const pred = predictions.predictions;
  const confidence = pred.confidence || 0;
  const isHighConfidence = confidence > 0.8;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis Results
          </DialogTitle>
          <DialogDescription>
            Review the predicted information before applying to the form
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Confidence Badge */}
          <div className="flex items-center gap-3">
            {isHighConfidence ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            <Badge 
              variant={isHighConfidence ? "default" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {Math.round(confidence * 100)}% Confidence
            </Badge>
            {!isHighConfidence && (
              <span className="text-xs text-muted-foreground">
                Please review carefully
              </span>
            )}
          </div>
          
          {/* Predictions Grid */}
          <div className="grid gap-4 p-4 border rounded-lg bg-muted/30">
            <PreviewField 
              label="Type" 
              value={pred.type ? getEntityTypeLabel(pred.type) : ''} 
            />
            <PreviewField label="Name" value={pred.name} />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              {pred.matched_category_name ? (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{pred.matched_category_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Matched in database ✓</p>
                  </div>
                </div>
              ) : pred.suggested_category_path ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{pred.suggested_category_path}</p>
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">
                      No exact match - select manually
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No category suggested</p>
              )}
            </div>
            <PreviewField label="Tags" value={pred.tags} />
            <PreviewField 
              label="Description" 
              value={pred.description} 
              multiline 
            />
            
            {/* Show primary image if available */}
            {pred.image_url && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Primary Image</Label>
                <ImageWithFallback
                  src={pred.image_url}
                  alt={pred.name || 'Primary image'}
                  entityType={pred.type || 'product'}
                  className="mt-2 rounded-md max-h-32 object-cover w-full"
                />
              </div>
            )}

            {/* Phase 8.1D: dedicated pricing preview */}
            {pred.additional_data?.pricing && (
              <PricingPreview pricing={pred.additional_data.pricing} />
            )}

            {/* Additional Data (excludes pricing, which renders above) */}
            {pred.additional_data &&
              Object.entries(pred.additional_data).filter(([k]) => k !== 'pricing').length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Additional Information</Label>
                <div className="grid gap-2 text-xs">
                  {Object.entries(pred.additional_data)
                    .filter(([key]) => key !== 'pricing')
                    .map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground capitalize font-medium">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* AI Reasoning */}
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>AI Reasoning</AlertTitle>
            <AlertDescription className="text-sm">
              {pred.reasoning}
            </AlertDescription>
          </Alert>
          
          {/* Warning for low confidence */}
          {!isHighConfidence && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Low Confidence Prediction</AlertTitle>
              <AlertDescription className="text-xs">
                The AI has low confidence in these predictions. 
                Please review and edit the fields manually after applying.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {requestId && (
          <p className="text-xs text-muted-foreground">
            Request ID: <span className="font-mono">{requestId}</span>
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={onApply} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Apply to Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
