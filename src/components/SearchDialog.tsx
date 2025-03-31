
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useSearch, SearchResult } from '@/hooks/use-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading, error, defaultUsers, loadingDefaultUsers } = useSearch(query);

  const handleUserClick = () => {
    onOpenChange(false);
    setQuery('');
  };

  // Determine which users to display
  const usersToDisplay = query ? results : defaultUsers;
  const isLoadingUsers = query ? isLoading : loadingDefaultUsers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-xl p-0 gap-0 overflow-hidden border-0 shadow-lg">
        <div className="flex items-center px-4 py-3 border-b">
          <div className="flex items-center w-full gap-2">
            <Search className="w-5 h-5 text-muted-foreground shrink-0 ml-2" />
            <Input
              type="text"
              placeholder="Search for people, products, food..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70 placeholder:font-normal"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-full hover:bg-transparent mr-4"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-0">
          {error && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {isLoadingUsers && (
            <div className="p-4">
              <div className="px-4 py-2 text-sm font-medium text-muted-foreground">
                People
              </div>
              {Array(3).fill(0).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoadingUsers && query && usersToDisplay.length === 0 && (
            <div className="p-8 text-center">
              <p className="mt-2 text-muted-foreground">No users found</p>
            </div>
          )}

          {usersToDisplay.length > 0 && (
            <div className="flex flex-col">
              <div className="px-4 py-2 text-sm font-medium text-muted-foreground">
                People
              </div>
              <div className="flex flex-col">
                {usersToDisplay.map((user) => (
                  <Link
                    key={user.id}
                    to={`/profile/${user.id}`}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors"
                    onClick={handleUserClick}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
                      <AvatarFallback>
                        {user.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{user.username || 'Unknown User'}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.bio || 'No bio available'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
