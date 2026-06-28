// Phase 3.3A-2 — "Did you mean?" pre-insert duplicate prompt.
import React from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { AlertTriangle } from 'lucide-react';

export interface DuplicateCandidate {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  type: string;
  parent_name: string | null;
  score: number;
  reasons: string[];
}

interface Props {
  open: boolean;
  candidates: DuplicateCandidate[];
  onCancel: () => void;
  onUseExisting: (c: DuplicateCandidate) => void;
  onContinueNew: () => void;
}

export const DuplicateConfirmDialog: React.FC<Props> = ({
  open, candidates, onCancel, onUseExisting, onContinueNew,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Did you mean one of these?
          </AlertDialogTitle>
          <AlertDialogDescription>
            We found {candidates.length} entit{candidates.length === 1 ? 'y' : 'ies'} that
            look similar. Pick an existing one, or continue creating a new entity.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border rounded-md p-2 bg-muted/30">
              <ImageWithFallback
                src={c.image_url ?? undefined}
                alt={c.name}
                entityType={c.type as any}
                className="h-12 w-12 rounded object-cover bg-muted shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {c.type}{c.parent_name ? ` · ${c.parent_name}` : ''}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {c.reasons.slice(0, 3).map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{r}</Badge>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onUseExisting(c)}>
                Use this
              </Button>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onContinueNew}>
            It's different — continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
