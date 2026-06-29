import React from 'react';
import { Badge } from '@/components/ui/badge';

interface Props {
  status?: string | null;
}

/** Admin-only chip. Do not render in public UI. */
export const EntityApprovalChip: React.FC<Props> = ({ status }) => {
  if (!status) return null;
  if (status === 'approved') return <Badge variant="secondary">approved</Badge>;
  if (status === 'pending') return <Badge variant="outline">pending</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">rejected</Badge>;
  return null;
};

export default EntityApprovalChip;
