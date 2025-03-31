
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/use-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { results, isLoading } = useSearch(query);

  const handleUserSelect = (userId: string) => {
    navigate(`/profile/${userId}`);
    onOpenChange(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for people, products, food..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent placeholder:text-muted-foreground/70"
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        
        <div className="max-h-[400px] overflow-y-auto p-2">
          {query && (
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
              People
            </div>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : results.length > 0 ? (
            <div>
              {results.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-accent cursor-pointer"
                  onClick={() => handleUserSelect(user.id)}
                >
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{user.username || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.bio || 'No bio available'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : query ? (
            <div className="text-center text-muted-foreground py-8">
              No users found
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Type to search users
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
