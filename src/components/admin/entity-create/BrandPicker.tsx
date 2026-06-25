import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandCandidate } from '@/types/entityDraft';

/**
 * BrandDecision is the explicit, conceptual model returned to the caller.
 * It never calls `create-brand-entity` itself — translation to writes
 * happens in DraftReviewBody.handleApply.
 */
export type BrandDecision =
  | { kind: 'existing'; entityId: string; candidate: BrandCandidate }
  | { kind: 'create_new'; candidate: BrandCandidate }
  | { kind: 'not_sure' }
  | { kind: 'not_listed' }
  | { kind: 'not_applicable' };

interface BrandPickerProps {
  candidates: BrandCandidate[];
  recommendedIndex?: number;
  defaultCollapsedNotApplicable?: boolean;
  value: BrandDecision | null;
  onChange: (decision: BrandDecision | null) => void;
}

export const BrandPicker: React.FC<BrandPickerProps> = ({
  candidates,
  recommendedIndex,
  defaultCollapsedNotApplicable = false,
  value,
  onChange,
}) => {
  // Track the "pending" create-new candidate awaiting Confirm.
  const [pendingNew, setPendingNew] = useState<BrandCandidate | null>(null);

  const recommended =
    typeof recommendedIndex === 'number' ? candidates[recommendedIndex] ?? null : null;

  const isSelected = (cand: BrandCandidate) => {
    if (!value) return false;
    if (value.kind === 'existing' && value.candidate === cand) return true;
    if (value.kind === 'create_new' && value.candidate === cand) return true;
    return false;
  };

  const handleCandidateClick = (cand: BrandCandidate) => {
    if (cand.status === 'matched_existing' && cand.id) {
      // Safe to one-click select.
      setPendingNew(null);
      onChange({ kind: 'existing', entityId: cand.id, candidate: cand });
    } else if (cand.status === 'suggested_new') {
      // Requires confirm step — never auto-select.
      onChange(null);
      setPendingNew(cand);
    }
  };

  if (defaultCollapsedNotApplicable && !value) {
    onChange({ kind: 'not_applicable' });
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        Brand / Parent
      </Label>

      {candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">No brand candidates found.</p>
      )}

      <div className="space-y-2">
        {candidates.map((cand, idx) => {
          const selected = isSelected(cand);
          const isRecommended = recommended === cand;
          const isMatched = cand.status === 'matched_existing';
          return (
            <button
              key={`${cand.name}-${idx}`}
              type="button"
              onClick={() => handleCandidateClick(cand)}
              className={cn(
                'w-full text-left rounded-md border p-3 transition-colors',
                selected
                  ? 'border-primary bg-primary/5'
                  : pendingNew === cand
                    ? 'border-yellow-500 bg-yellow-500/5'
                    : 'border-border hover:bg-muted/50',
              )}
            >
              <div className="flex items-start gap-3">
                {cand.logoUrl && (
                  <img
                    src={cand.logoUrl}
                    alt=""
                    className="h-8 w-8 rounded object-contain bg-muted flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium truncate">{cand.name}</p>
                    {isMatched && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Check className="h-3 w-3" /> in database
                      </Badge>
                    )}
                    {cand.status === 'suggested_new' && (
                      <Badge variant="outline" className="text-xs">new</Badge>
                    )}
                    {isRecommended && (
                      <Badge className="text-xs">recommended</Badge>
                    )}
                  </div>
                  {cand.websiteUrl && (
                    <p className="text-xs text-muted-foreground truncate" title={cand.websiteUrl}>
                      {cand.websiteUrl}
                    </p>
                  )}
                  {cand.reason && (
                    <p className="text-xs text-muted-foreground mt-1">{cand.reason}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {pendingNew && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Confirm new brand</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-xs">
              No matching brand was found for <strong>{pendingNew.name}</strong>. Create it as a
              new brand entity?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onChange({ kind: 'create_new', candidate: pendingNew });
                }}
              >
                Confirm create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPendingNew(null);
                  onChange(null);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          variant={value?.kind === 'not_sure' ? 'default' : 'outline'}
          onClick={() => {
            setPendingNew(null);
            onChange({ kind: 'not_sure' });
          }}
        >
          Not sure
        </Button>
        <Button
          size="sm"
          variant={value?.kind === 'not_listed' ? 'default' : 'outline'}
          onClick={() => {
            setPendingNew(null);
            onChange({ kind: 'not_listed' });
          }}
        >
          Brand not listed
        </Button>
        <Button
          size="sm"
          variant={value?.kind === 'not_applicable' ? 'default' : 'outline'}
          onClick={() => {
            setPendingNew(null);
            onChange({ kind: 'not_applicable' });
          }}
        >
          Not applicable
        </Button>
      </div>
    </div>
  );
};
