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

interface AutoFillPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  predictions: any;
  onApply: () => void;
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
  onApply
}) => {
  // Request ID is surfaced from V2 success metadata or error envelope.
  const requestId: string | null =
    predictions?.metadata?.request_id ??
    predictions?.request_id ??
    null;

  // No predictions available → render inline failure state with optional
  // request_id. This appears only after the analyze request has resolved
  // (loading states never open the modal). "Apply to form" is hidden.
  if (!predictions?.predictions) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              AI couldn't extract details
            </DialogTitle>
            <DialogDescription>
              AI couldn't extract reliable details from this URL. You can fill
              the form manually or try again.
            </DialogDescription>
          </DialogHeader>
          {requestId && (
            <p className="text-xs text-muted-foreground">
              Request ID: <span className="font-mono">{requestId}</span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
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
