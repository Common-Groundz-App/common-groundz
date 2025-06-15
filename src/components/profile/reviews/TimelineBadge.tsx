
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface TimelineBadgeProps {
  updateCount: number;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

export const TimelineBadge = ({ updateCount, variant = 'outline', size = 'md' }: TimelineBadgeProps) => {
  return (
    <Badge variant={variant} className="flex items-center gap-1 text-xs">
      <Clock className="h-3 w-3" />
      <span>{updateCount} update{updateCount !== 1 ? 's' : ''}</span>
    </Badge>
  );
};
