import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Check, PlusCircle } from 'lucide-react';
import { UnifiedEntitySelector } from '@/components/feed/UnifiedEntitySelector';
import { EntityAdapter } from '@/components/profile/circles/types';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { useEntityImageFallback } from '@/hooks/useEntityImageFallback';
import { getEntityFallbackIcon } from '@/utils/entityImageFallback';
import SubjectQuickCreate from './SubjectQuickCreate';
import { useSearchFunnel } from '@/hooks/useSearchFunnel';
import {
  type SubjectRequirement,
  allowsMissingSubject,
} from '../reviewSubjectPolicy';

interface SubjectSelectStepProps {
  /** The currently chosen subject, if any. */
  subject: EntityAdapter | null;
  /** Called with the new subject, or `null` when the user clears it. */
  onSubjectChange: (subject: EntityAdapter | null) => void;
  /** Locked when the review was opened from an entity page. */
  disabled?: boolean;
  /** How strict the subject requirement is for this form instance. */
  requirement: SubjectRequirement;
  /** Called when a legacy-optional review chooses to continue unlinked. */
  onContinueWithoutSubject?: () => void;
  /** Async parent-context line for offerings (e.g. "Dish at Toit"). */
  contextLine?: string | null;
  isResolvingContext?: boolean;
  /** Reports while an outside search result is being saved to Groundz. */
  onAddingChange?: (adding: boolean) => void;
  isAdding?: boolean;
  /**
   * Edit mode for a linked review: the subject can never change. When the
   * subject details are not loaded yet this shows a placeholder or an
   * "unavailable" card — never the search box.
   */
  locked?: boolean;
  lockedStatus?: 'loading' | 'error' | 'ready';
  onRetryLocked?: () => void;
}

export const SubjectThumbnail = ({ subject }: { subject: EntityAdapter }) => {
  const { imageUrl, showFallback, markImageFailed } = useEntityImageFallback(subject);
  const FallbackIcon = getEntityFallbackIcon(subject.type);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
      {showFallback ? (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          <FallbackIcon className="h-1/2 w-1/2" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={imageUrl ?? undefined}
          alt={subject.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={markImageFailed}
        />
      )}
    </div>
  );
};

/**
 * Step 2 — "What are you reviewing?"
 *
 * Replaces the abstract category picker with a real, cross-type subject search
 * (the same search the composer uses). The subject is what determines the rest
 * of the form; the legacy `category` is derived from it.
 */
const SubjectSelectStep = ({
  subject,
  onSubjectChange,
  disabled = false,
  requirement,
  onContinueWithoutSubject,
  contextLine,
  isResolvingContext = false,
  onAddingChange,
  isAdding = false,
  locked = false,
  lockedStatus = 'ready',
  onRetryLocked,
}: SubjectSelectStepProps) => {
  const isLocked = locked || disabled;
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const { log: logFunnel } = useSearchFunnel();

  return (
    <div className="flex flex-col py-6 px-2 sm:px-4 space-y-5 w-full">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-medium">What are you reviewing?</h2>
        <p className="text-sm text-muted-foreground">
          Search for the exact thing — a dish, a product, a place, a book, a course.
        </p>
      </div>

      {subject ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
          <SubjectThumbnail subject={subject} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="truncate font-medium">{subject.name}</p>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {isResolvingContext
                ? 'Finding where this is from...'
                : contextLine || getEntityTypeLabel(subject.type)}
            </p>
          </div>
          {!isLocked && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear selected subject"
              onClick={() => onSubjectChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : locked && lockedStatus === 'error' ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-center space-y-2" role="alert">
          <p className="font-medium">Subject unavailable</p>
          <p className="text-sm text-muted-foreground">
            This review stays linked to its original subject and can't be reassigned.
          </p>
          {onRetryLocked && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryLocked}>
              Try again
            </Button>
          )}
        </div>
      ) : locked ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3" aria-busy="true" data-testid="locked-subject-skeleton">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ) : (
        <UnifiedEntitySelector
          mode="subject"
          variant="modal"
          maxEntities={1}
          recentsSurface="review_subject"
          allowInlineCreate={false}
          externalResultPolicy="createIfMissing"
          onResolvingChange={onAddingChange}
          onEntitiesChange={(entities) => onSubjectChange(entities[0] ?? null)}
        />
      )}

      {!subject && !isLocked && isAdding && (
        <p className="text-center text-sm text-muted-foreground" role="status">
          Adding to Groundz…
        </p>
      )}

      {!subject && !isLocked && !isAdding && (
        <div className="text-center space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQuickCreateOpen(true)}
          >
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Can't find it? Add something new
          </Button>
          {allowsMissingSubject(requirement) && onContinueWithoutSubject && (
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={onContinueWithoutSubject}>
                Continue without linking
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                You can keep this older review unlinked and continue editing it.
              </p>
            </div>
          )}
        </div>
      )}

      <SubjectQuickCreate
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        onCreated={(entity) => onSubjectChange(entity)}
        logEvent={(event, payload) =>
          logFunnel({ event, source: 'review_form', ...payload } as any)
        }
      />

      {isLocked && subject && (
        <p className="text-center text-sm text-muted-foreground">
          You're reviewing {subject.name}.
        </p>
      )}
    </div>
  );
};

export default SubjectSelectStep;
