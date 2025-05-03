
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UsernameLinkProps {
  username?: string | null;
  userId?: string | null;
  className?: string;
  fallback?: string;
  isCurrentUser?: boolean;
  children?: React.ReactNode;
}

/**
 * A component that renders a username as a clickable link to the user's profile.
 * Falls back to the provided fallback text if no username is available.
 * Can also accept children to wrap them in a link to the user's profile.
 */
const UsernameLink: React.FC<UsernameLinkProps> = ({ 
  username, 
  userId, 
  className,
  fallback = 'Anonymous',
  isCurrentUser = false,
  children
}) => {
  if (!userId) {
    return children ? <span className={className}>{children}</span> : <span className={className}>{fallback}</span>;
  }

  if (children) {
    return (
      <Link
        to={`/profile/${userId}`}
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

  return (
    <Link
      to={`/profile/${userId}`}
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
