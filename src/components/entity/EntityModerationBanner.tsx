import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Clock, ShieldAlert } from 'lucide-react';

interface Props {
  approvalStatus?: string | null;
  rejectionReason?: string | null;
  /** Whether the current viewer is the creator or an admin. Banner only renders if true. */
  viewerCanSee: boolean;
}

/**
 * Shown only to the creator or admins. Public viewers should not see this.
 */
export const EntityModerationBanner: React.FC<Props> = ({
  approvalStatus,
  rejectionReason,
  viewerCanSee,
}) => {
  if (!viewerCanSee) return null;
  if (approvalStatus !== 'pending' && approvalStatus !== 'rejected') return null;

  if (approvalStatus === 'pending') {
    return (
      <Alert className="mb-4">
        <Clock className="h-4 w-4" />
        <AlertTitle>Pending review</AlertTitle>
        <AlertDescription>
          This entity is publicly visible but still awaiting admin review. An admin may reject it if it doesn't meet our guidelines.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="mb-4">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Hidden from the public</AlertTitle>
      <AlertDescription>
        {rejectionReason
          ? <>This entity was rejected by an admin. Reason: <span className="font-medium">{rejectionReason}</span></>
          : 'This entity was rejected by an admin and is hidden from the public.'}
      </AlertDescription>
    </Alert>
  );
};

export default EntityModerationBanner;
