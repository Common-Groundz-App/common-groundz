
import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
  showAddButton?: boolean;
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag...',
  maxTags = 10,
  showAddButton = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current && 
        !suggestionRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredSuggestions(suggestions.filter(suggestion => !tags.includes(suggestion)));
    } else {
      setFilteredSuggestions(
        suggestions.filter(
          suggestion => 
            suggestion.toLowerCase().includes(inputValue.toLowerCase()) && 
            !tags.includes(suggestion)
        )
      );
    }
  }, [inputValue, suggestions, tags]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!showSuggestions) setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      const newTags = [...tags];
      newTags.pop();
      onChange(newTags);
    }
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (
      trimmedTag && 
      !tags.includes(trimmedTag) && 
      tags.length < maxTags
    ) {
      const newTags = [...tags, trimmedTag];
      onChange(newTags);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    onChange(newTags);
  };

  const handleAddClick = () => {
    if (inputValue.trim().length === 0) return;
    addTag(inputValue);
  };

  const handleBlur = () => {
    if (!showAddButton && inputValue.trim()) {
      addTag(inputValue);
    }
  };

  return (
    <div className="border rounded-md p-2 bg-background">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <div 
            key={index} 
            className="bg-brand-orange/20 text-brand-orange rounded-full py-1 px-3 text-sm flex items-center"
          >
            {tag}
            <button 
              onClick={() => removeTag(index)}
              className="ml-1 p-0.5 rounded-full hover:bg-brand-orange/30"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="relative flex-1 min-w-[120px]">
          {showAddButton ? (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={tags.length === 0 ? placeholder : ""}
                className="outline-none bg-transparent flex-1 text-sm"
                disabled={tags.length >= maxTags}
              />
              <button
                type="button"
                onClick={handleAddClick}
                disabled={tags.length >= maxTags || inputValue.trim().length === 0}
                className="px-3 py-1 bg-brand-orange text-white text-sm rounded hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={handleBlur}
                placeholder={tags.length === 0 ? placeholder : ""}
                className="outline-none bg-transparent w-full text-sm"
                disabled={tags.length >= maxTags}
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div 
                  ref={suggestionRef}
                  className="absolute top-full left-0 mt-1 w-full bg-background border rounded-md shadow-md z-10"
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "px-3 py-2 cursor-pointer hover:bg-accent/50 text-sm",
                        index + 1 < filteredSuggestions.length && "border-b border-border/40"
                      )}
                      onClick={() => addTag(suggestion)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {tags.length >= maxTags && (
        <p className="text-xs text-muted-foreground mt-2">
          Maximum {maxTags} tags allowed.
        </p>
      )}
    </div>
  );
};

export default TagInput;
