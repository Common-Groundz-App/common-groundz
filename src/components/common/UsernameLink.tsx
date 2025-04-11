
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UsernameLinkProps {
  username?: string | null;
  userId?: string | null;
  className?: string;
  fallback?: string;
  isCurrentUser?: boolean;
}

/**
 * A component that renders a username as a clickable link to the user's profile.
 * Falls back to the provided fallback text if no username is available.
 */
const UsernameLink: React.FC<UsernameLinkProps> = ({ 
  username, 
  userId, 
  className,
  fallback = 'Anonymous',
  isCurrentUser = false
}) => {
  if (!username || !userId) {
    return <span className={className}>{fallback}</span>;
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
      {username}{isCurrentUser ? ' (You)' : ''}
    </Link>
  );
};

export default UsernameLink;
