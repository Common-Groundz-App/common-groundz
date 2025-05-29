
import React from 'react';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { ProfileDisplay } from '@/components/common/ProfileDisplay';
import { formatRelativeDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

interface MinimalAuthorInfoProps {
  userId: string;
  createdAt: string;
  className?: string;
}

export const MinimalAuthorInfo: React.FC<MinimalAuthorInfoProps> = ({
  userId,
  createdAt,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ProfileAvatar
        userId={userId}
        size="xs"
        className="ring-1 ring-border"
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ProfileDisplay
          userId={userId}
          size="xs"
          showUsername={true}
          showLink={true}
          className="font-medium hover:text-foreground transition-colors"
        />
        <span>•</span>
        <span>{formatRelativeDate(createdAt)}</span>
      </div>
    </div>
  );
};
