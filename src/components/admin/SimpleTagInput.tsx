import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface SimpleTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  className?: string;
  onClearAll?: () => void;
}

export const SimpleTagInput: React.FC<SimpleTagInputProps> = ({
  value,
  onChange,
  label = 'Tags',
  placeholder = 'Type a tag and press Enter',
  maxTags = 10,
  disabled = false,
  className = '',
  onClearAll
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleAddTag = () => {
    const trimmedTag = inputValue.trim();
    
    if (!trimmedTag) return;
    
    // Check if already exists (case insensitive)
    if (value.some(tag => tag.toLowerCase() === trimmedTag.toLowerCase())) {
      setInputValue('');
      return;
    }
    
    // Check max tags
    if (value.length >= maxTags) {
      setInputValue('');
      return;
    }
    
    onChange([...value, trimmedTag]);
    setInputValue('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value.length > 0 && onClearAll && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            disabled={disabled}
            className="h-auto py-1 px-2 text-xs"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              className="gap-1 bg-brand-orange text-white hover:bg-brand-orange/90 border-transparent"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                disabled={disabled}
                className="ml-1 hover:bg-white/20 rounded-full p-0.5"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input field */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || value.length >= maxTags}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={handleAddTag}
          disabled={disabled || !inputValue.trim() || value.length >= maxTags}
          className="bg-brand-orange text-white hover:bg-brand-orange/90"
        >
          Add
        </Button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        {value.length} / {maxTags} tags
        {value.length >= maxTags && ' (maximum reached)'}
      </p>
    </div>
  );
};
