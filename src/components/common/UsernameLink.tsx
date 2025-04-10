
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UsernameLinkProps {
  username?: string | null;
  userId?: string | null;
  className?: string;
  fallback?: string;
}

/**
 * A component that renders a username as a clickable link to the user's profile.
 * Falls back to the provided fallback text if no username is available.
 */
const UsernameLink: React.FC<UsernameLinkProps> = ({ 
  username, 
  userId, 
  className,
  fallback = 'Anonymous'
}) => {
  if (!username || !userId) {
    return <span className={cn("font-medium", className)}>{fallback}</span>;
  }

  return (
    <Link
      to={`/profile/${userId}`}
      className={cn(
        "font-medium hover:underline transition-all", 
        className
      )}
    >
      {username}
    </Link>
  );
};

export default UsernameLink;
