
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface UsernameLinkProps {
  username?: string | null;
  userId?: string | null;
  className?: string;
  fallback?: string;
  isCurrentUser?: boolean;
  children?: React.ReactNode;
  isLoading?: boolean;
  displayName?: string | null;
  showHandle?: boolean;
}

/**
 * Twitter/X-style identity link component.
 * 
 * When `displayName` is provided:
 * - Shows displayName as bold primary text
 * - Shows @username as muted secondary text (controlled by showHandle)
 * - Uses username for routing only
 * 
 * When `displayName` is NOT provided:
 * - Falls back to current behavior (shows username as the label)
 */
const UsernameLink: React.FC<UsernameLinkProps> = ({ 
  username, 
  userId, 
  className,
  fallback = 'Anonymous',
  isCurrentUser = false,
  children,
  isLoading = false,
  displayName,
  showHandle = true
}) => {
  // Show skeleton loader during loading state
  if (isLoading) {
    return <Skeleton className={cn("h-4 w-20", className)} />;
  }

  if (!userId) {
    return children ? <span className={className}>{children}</span> : <span className={className}>{fallback}</span>;
  }

  if (children) {
    const profilePath = username ? `/u/${username}` : `/profile/${userId}`;
    return (
      <Link
        to={profilePath}
        className={cn(
          "transition-all", 
          isCurrentUser && "text-primary",
          className
        )}
      >
        {children}
      </Link>
    );
  }

  const profilePath = username ? `/u/${username}` : `/profile/${userId}`;
  
  // Twitter/X model: displayName as primary, @username as secondary (inline)
  if (displayName) {
    return (
      <div className={cn("flex items-baseline gap-1.5 flex-wrap", className)}>
        <Link
          to={profilePath}
          className={cn(
            "font-semibold hover:underline transition-all text-sm leading-tight",
            isCurrentUser && "text-primary"
          )}
        >
          {displayName}{isCurrentUser ? ' (You)' : ''}
        </Link>
        {showHandle && username && (
          <Link
            to={profilePath}
            className="text-xs text-muted-foreground hover:underline leading-tight"
          >
            @{username}
          </Link>
        )}
      </div>
    );
  }

  // Legacy fallback: show username as the label
  return (
    <Link
      to={profilePath}
      className={cn(
        "font-medium hover:underline transition-all", 
        isCurrentUser && "text-primary",
        className
      )}
    >
      {username || fallback}{isCurrentUser ? ' (You)' : ''}
    </Link>
  );
};

export default UsernameLink;
