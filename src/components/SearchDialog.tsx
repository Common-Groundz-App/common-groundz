
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X, User } from 'lucide-react';
import { useSearch, SearchResult } from '@/hooks/use-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading, error } = useSearch(query);

  const handleUserClick = () => {
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl p-0 gap-0 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b">
          <div className="flex items-center flex-1 gap-2 bg-muted/50 rounded-full pl-3 pr-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-full hover:bg-muted"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {error && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!isLoading && query && results.length === 0 && (
            <div className="p-8 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No users found</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="flex flex-col divide-y animate-in fade-in-50 duration-200">
              {results.map((user) => (
                <Link
                  key={user.id}
                  to={`/profile/${user.id}`}
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={handleUserClick}
                >
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.username || 'Unknown User'}</p>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{user.bio}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!query && (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="mt-2 text-muted-foreground">Type to search users</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
