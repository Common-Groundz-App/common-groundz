import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { cn } from '@/lib/utils';
import { User, MapPin, Package, Music, Book, Film } from 'lucide-react';

interface MentionTypeaheadProps {
  query: string;
  open: boolean;
  onSelect: (mention: MentionResult) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export interface MentionResult {
  type: 'user' | 'entity';
  id: string;
  name: string;
  displayName: string;
  avatar?: string;
  entityType?: string;
  username?: string;
}

const getEntityIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'place':
      return <MapPin className="h-3 w-3" />;
    case 'product':
      return <Package className="h-3 w-3" />;
    case 'movie':
      return <Film className="h-3 w-3" />;
    case 'book':
      return <Book className="h-3 w-3" />;
    case 'music':
      return <Music className="h-3 w-3" />;
    default:
      return <Package className="h-3 w-3" />;
  }
};

export function MentionTypeahead({ query, open, onSelect, onClose, position }: MentionTypeaheadProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);

  const { results: searchResults, isLoading } = useUnifiedSearch(debouncedQuery.length >= 2 ? debouncedQuery : '');

  // Process search results into mentions
  const mentions: MentionResult[] = React.useMemo(() => {
    if (!searchResults) return [];
    
    const results: MentionResult[] = [];
    
    // Add users from search results
    if (searchResults.users?.length) {
      searchResults.users.forEach(user => {
        results.push({
          type: 'user',
          id: user.id,
          name: user.username || 'User',
          displayName: user.username || 'User',
          avatar: user.avatar_url,
          username: user.username
        });
      });
    }
    
    // Add entities from search results
    if (searchResults.entities?.length) {
      searchResults.entities.forEach(entity => {
        results.push({
          type: 'entity',
          id: entity.id,
          name: entity.name,
          displayName: entity.name,
          avatar: entity.image_url,
          entityType: entity.type
        });
      });
    }
    
    return results;
  }, [searchResults]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [mentions]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % mentions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev <= 0 ? mentions.length - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (mentions[selectedIndex]) {
            onSelect(mentions[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, mentions, selectedIndex, onSelect, onClose]);

  if (!open) return null;

  const showHint = query.length < 2;
  const showResults = query.length >= 2 && mentions.length > 0;
  const showNoResults = query.length >= 2 && mentions.length === 0 && !isLoading;

  return (
    <div 
      className="absolute z-50 w-64 bg-background border border-border rounded-lg shadow-lg overflow-hidden"
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      {showHint && (
        <div className="p-3 text-sm text-muted-foreground">
          Type 2+ characters to search for people and places
        </div>
      )}
      
      {isLoading && query.length >= 2 && (
        <div className="p-3 text-sm text-muted-foreground">
          Searching...
        </div>
      )}
      
      {showNoResults && (
        <div className="p-3 text-sm text-muted-foreground">
          No results found for "{query}"
        </div>
      )}
      
      {showResults && (
        <div className="max-h-64 overflow-y-auto">
          {/* Users Section */}
          {mentions.filter(m => m.type === 'user').length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-accent/10 border-b">
                People
              </div>
              {mentions
                .filter(m => m.type === 'user')
                .map((mention, index) => {
                  const globalIndex = mentions.findIndex(m => m.id === mention.id);
                  return (
                    <div
                      key={mention.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/20",
                        selectedIndex === globalIndex && "bg-accent/30"
                      )}
                      onClick={() => onSelect(mention)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={mention.avatar} alt={mention.displayName} />
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{mention.displayName}</div>
                        {mention.username && (
                          <div className="text-sm text-muted-foreground truncate">
                            @{mention.username}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
          
          {/* Entities Section */}
          {mentions.filter(m => m.type === 'entity').length > 0 && (
            <>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-accent/10 border-b">
                Places & Things
              </div>
              {mentions
                .filter(m => m.type === 'entity')
                .map((mention, index) => {
                  const globalIndex = mentions.findIndex(m => m.id === mention.id);
                  return (
                    <div
                      key={mention.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/20",
                        selectedIndex === globalIndex && "bg-accent/30"
                      )}
                      onClick={() => onSelect(mention)}
                    >
                      <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center overflow-hidden">
                        {mention.avatar ? (
                          <img src={mention.avatar} alt={mention.name} className="h-full w-full object-cover" />
                        ) : (
                          getEntityIcon(mention.entityType || '')
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{mention.name}</div>
                        {mention.entityType && (
                          <Badge variant="secondary" className="text-xs">
                            {mention.entityType}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}