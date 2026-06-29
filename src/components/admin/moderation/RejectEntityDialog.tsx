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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  entityName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export const RejectEntityDialog: React.FC<Props> = ({ open, entityName, busy, onCancel, onConfirm }) => {
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const canSubmit = reason.trim().length > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject entity</DialogTitle>
          <DialogDescription>
            Rejecting will hide <span className="font-medium">{entityName}</span> from the public. A reason is required and will be logged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. duplicate of an existing entity, spam, low quality, off-policy…"
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim())} disabled={!canSubmit}>
            {busy ? 'Rejecting…' : 'Reject entity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectEntityDialog;
