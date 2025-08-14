import React, { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Hash, TrendingUp } from 'lucide-react';
import { searchHashtags, getTrendingHashtags } from '@/services/hashtagService';

interface HashtagSuggestion {
  name: string;
  normalized: string;
  post_count?: number;
  is_trending?: boolean;
}

interface HashtagAutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onHashtagSelect: (hashtag: string) => void;
  className?: string;
}

export function HashtagAutocomplete({ inputRef, onHashtagSelect, className }: HashtagAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Track cursor position for hashtag detection
  const checkForHashtag = () => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const value = input.value;
    const cursorPos = input.selectionStart || 0;

    // Find hashtag being typed
    const beforeCursor = value.substring(0, cursorPos);
    const hashtagMatch = beforeCursor.match(/#(\w*)$/);

    if (hashtagMatch) {
      const query = hashtagMatch[1];
      setCurrentQuery(query);
      
      // Calculate position for the dropdown
      const rect = input.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
      
      setOpen(true);
      fetchSuggestions(query);
    } else {
      setOpen(false);
      setCurrentQuery('');
    }
  };

  const fetchSuggestions = async (query: string) => {
    setIsLoading(true);
    try {
      let results: HashtagSuggestion[] = [];
      
      if (query.length === 0) {
        // Show trending hashtags when no query
        const trending = await getTrendingHashtags(8);
        results = trending.map(tag => ({
          name: tag.name_original,
          normalized: tag.name_norm,
          post_count: tag.post_count,
          is_trending: true
        }));
      } else if (query.length >= 1) {
        // Search hashtags matching the query
        const searched = await searchHashtags(query, 8);
        results = searched.map(tag => ({
          name: tag.name_original,
          normalized: tag.name_norm,
          post_count: tag.post_count,
          is_trending: false
        }));
      }
      
      setSuggestions(results);
    } catch (error) {
      console.error('Error fetching hashtag suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (hashtag: string) => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const value = input.value;
    const cursorPos = input.selectionStart || 0;

    // Replace the current hashtag being typed
    const beforeCursor = value.substring(0, cursorPos);
    const afterCursor = value.substring(cursorPos);
    const hashtagMatch = beforeCursor.match(/^(.*)#(\w*)$/);

    if (hashtagMatch) {
      const [, before] = hashtagMatch;
      const newValue = before + '#' + hashtag + ' ' + afterCursor;
      
      // Update the input value
      if ('value' in input) {
        input.value = newValue;
      }
      
      // Position cursor after the hashtag
      const newCursorPos = before.length + hashtag.length + 2;
      input.setSelectionRange(newCursorPos, newCursorPos);
      
      // Trigger change event
      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);
      
      onHashtagSelect(hashtag);
    }

    setOpen(false);
  };

  // Listen for input changes and cursor movements
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleInputChange = () => {
      setTimeout(checkForHashtag, 0);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        setTimeout(checkForHashtag, 0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    const handleClick = () => {
      setTimeout(checkForHashtag, 0);
    };

    input.addEventListener('input', handleInputChange);
    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('click', handleClick);

    return () => {
      input.removeEventListener('input', handleInputChange);
      input.removeEventListener('keydown', handleKeyDown);
      input.removeEventListener('click', handleClick);
    };
  }, [inputRef, open]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.hashtag-autocomplete')) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`hashtag-autocomplete fixed z-50 ${className}`}
      style={{
        top: position.top + 4,
        left: position.left,
        minWidth: '280px',
        maxWidth: '400px'
      }}
    >
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        <Command>
          <CommandList className="max-h-64">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Searching hashtags...
              </div>
            ) : suggestions.length > 0 ? (
              <CommandGroup>
                {currentQuery.length === 0 && (
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                    <TrendingUp className="w-3 h-3 inline mr-1" />
                    Trending Hashtags
                  </div>
                )}
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion.normalized}
                    value={suggestion.name}
                    onSelect={() => handleSelect(suggestion.name)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">#{suggestion.name}</span>
                      {suggestion.is_trending && (
                        <TrendingUp className="w-3 h-3 text-orange-500" />
                      )}
                    </div>
                    {suggestion.post_count && (
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.post_count} posts
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">
                {currentQuery.length === 0 ? 'No trending hashtags' : `No hashtags found for "${currentQuery}"`}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </div>
    </div>
  );
}

export default HashtagAutocomplete;