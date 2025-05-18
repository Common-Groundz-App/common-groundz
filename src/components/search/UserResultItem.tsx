
import React from 'react';
import { Link } from 'react-router-dom';
import { SearchResult } from '@/hooks/use-unified-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface UserResultItemProps {
  user: SearchResult;
  onClick: () => void;
}

export function UserResultItem({ user, onClick }: UserResultItemProps) {
  return (
    <Link
      to={`/profile/${user.id}`}
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/30 transition-colors"
      onClick={onClick}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
        <AvatarFallback>
          {user.username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{user.username || 'Unknown User'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {user.bio || 'No bio available'}
        </p>
      </div>
    </Link>
  );
}
