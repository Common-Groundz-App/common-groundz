import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info, ExternalLink, PenSquare } from 'lucide-react';

export interface CreatedEntitySummary {
  id: string;
  name: string;
  slug?: string | null;
  type: string;
  isPending?: boolean;
}

interface PostCreateContinuationProps {
  open: boolean;
  entity: CreatedEntitySummary | null;
  onClose: () => void;
}

/**
 * Phase 3.4D — PostCreateContinuation
 *
 * Conservative first version. Route support verified:
 *  - /entity/:slug          → "View entity"        (always shown)
 *  - /create?entityId=...   → "Post about this"    (supported, shown)
 *  - Review composer is state-only on EntityDetail with no query/state hook,
 *    so "Write a review" is intentionally NOT shown yet.
 */
export const PostCreateContinuation: React.FC<PostCreateContinuationProps> = ({
  open,
  entity,
  onClose,
}) => {
  const navigate = useNavigate();

  if (!entity) return null;

  const handleViewEntity = () => {
    onClose();
    if (entity.slug) {
      navigate(`/entity/${entity.slug}`);
    }
  };

  const handlePostAbout = () => {
    onClose();
    const params = new URLSearchParams({
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.type,
    });
    navigate(`/create?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entity saved</DialogTitle>
          <DialogDescription>
            What would you like to do next with{' '}
            <span className="font-medium text-foreground">{entity.name}</span>?
          </DialogDescription>
        </DialogHeader>

        {entity.isPending && (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              Your entity is under review — visible with a Pending badge until an admin approves it.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {entity.slug && (
            <Button variant="default" onClick={handleViewEntity} className="justify-start">
              <ExternalLink className="h-4 w-4 mr-2" />
              View entity
            </Button>
          )}
          <Button variant="secondary" onClick={handlePostAbout} className="justify-start">
            <PenSquare className="h-4 w-4 mr-2" />
            Post about this
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Just save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
