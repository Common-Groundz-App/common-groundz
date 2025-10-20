import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Loader2 } from 'lucide-react';
import { searchTags, getOrCreateTag } from '@/services/tagService';
import { useDebounce } from '@/hooks/use-debounce';
import { Database } from '@/integrations/supabase/types';

// ✅ STRICT: Use exact database type
export type Tag = Database['public']['Tables']['tags']['Row'];

interface TagInputProps {
  // ✅ STRICT: Always a Tag array, never undefined
  value: Tag[];
  onChange: (tags: Tag[]) => void;
  label?: string;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
  onClearAll?: () => void;
}

export const TagInput: React.FC<TagInputProps> = ({
  value,
  onChange,
  label = 'Tags',
  placeholder = 'Add tags (e.g., korean-beauty, cruelty-free)',
  maxTags = 10,
  disabled = false,
  className = '',
  onClearAll
}) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debouncedInput = useDebounce(input, 300);
  
  // Load tag suggestions based on debounced input
  useEffect(() => {
    const loadSuggestions = async () => {
      if (debouncedInput.length < 2) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      try {
        const results = await searchTags(debouncedInput);
        
        // ✅ STRICT: Filter out already-selected tags by ID comparison
        const filtered = results.filter(
          tag => !value.find(t => t.id === tag.id)
        );
        
        setSuggestions(filtered);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error searching tags:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadSuggestions();
  }, [debouncedInput, value]);
  
  // Add existing tag from suggestions
  const handleAddTag = (tag: Tag) => {
    if (value.length >= maxTags) {
      return;
    }
    
    // ✅ STRICT: Type-safe duplicate check
    if (!value.find(t => t.id === tag.id)) {
      onChange([...value, tag]);
    }
    
    // Clear input and hide suggestions
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };
  
  // Create new tag or add existing one
  const handleCreateNewTag = async (tagName: string) => {
    if (value.length >= maxTags) {
      return;
    }
    
    const trimmedName = tagName.trim();
    if (!trimmedName) {
      return;
    }
    
    try {
      setLoading(true);
      
      // ✅ STRICT: getOrCreateTag returns complete Tag object from DB
      const newTag = await getOrCreateTag(trimmedName);
      
      // Add tag if not already selected
      if (!value.find(t => t.id === newTag.id)) {
        onChange([...value, newTag]);
      }
      
      setInput('');
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Remove tag by ID
  const handleRemoveTag = (tagId: string) => {
    // ✅ STRICT: Filter by exact ID match
    onChange(value.filter(t => t.id !== tagId));
  };
  
  // Clear all tags at once
  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll(); // Use parent handler if provided
    } else {
      onChange([]); // Fallback to direct clearing
    }
    
    // Clear UI state
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };
  
  // Handle keyboard interactions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      
      // If there are suggestions, add the first one
      if (suggestions.length > 0) {
        handleAddTag(suggestions[0]);
      } else {
        // Otherwise create a new tag
        handleCreateNewTag(input.trim());
      }
    } else if (e.key === 'Escape') {
      // Clear input and hide suggestions
      setInput('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };
  
  // Check if max tags reached
  const isMaxReached = value.length >= maxTags;
  const isInputDisabled = disabled || loading || isMaxReached;
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label with tag count and clear button */}
      <div className="flex items-center justify-between">
        <Label htmlFor="tag-input">
          {label}
          {value.length > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              ({value.length}/{maxTags})
            </span>
          )}
        </Label>
        
        {value.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            Clear All
          </Button>
        )}
      </div>
      
      {/* Selected tags display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-muted/50">
          {value.map(tag => (
            <Badge 
              key={tag.id} 
              variant="secondary" 
              className="gap-1 transition-colors"
            >
              {tag.name}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                onClick={() => handleRemoveTag(tag.id)}
                aria-label={`Remove ${tag.name} tag`}
              />
            </Badge>
          ))}
        </div>
      )}
      
      {/* Tag input with autocomplete */}
      <div className="relative">
        <Input
          id="tag-input"
          placeholder={
            isMaxReached 
              ? `Maximum ${maxTags} tags reached` 
              : placeholder
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={isInputDisabled}
          aria-autocomplete="list"
          aria-controls="tag-suggestions"
          aria-expanded={showSuggestions && suggestions.length > 0}
        />
        
        {/* Loading spinner */}
        {loading && (
          <Loader2 
            className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" 
            aria-label="Loading tags"
          />
        )}
        
        {/* Autocomplete suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div 
            id="tag-suggestions"
            className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
            role="listbox"
          >
            {suggestions.map(tag => (
              <div
                key={tag.id}
                className="px-3 py-2 hover:bg-accent cursor-pointer flex justify-between items-center transition-colors"
                onClick={() => handleAddTag(tag)}
                role="option"
                aria-selected={false}
              >
                <span className="font-medium">{tag.name}</span>
                <Badge variant="outline" className="text-xs">
                  {tag.usage_count} use{tag.usage_count !== 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        {isMaxReached 
          ? `You've reached the maximum of ${maxTags} tags`
          : 'Press Enter to create new tags, or select from suggestions'
        }
      </p>
    </div>
  );
};
