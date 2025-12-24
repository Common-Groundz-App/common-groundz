import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CanonicalCategory, PreferenceValue, CANONICAL_CATEGORIES } from '@/types/preferences';
import { createPreferenceValue } from '@/utils/preferenceRouting';

interface AddCustomPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: CanonicalCategory | string, value: PreferenceValue) => void;
}

// Category display names and emojis
const CATEGORY_OPTIONS: { value: CanonicalCategory | 'custom'; label: string; emoji: string }[] = [
  { value: 'skin_type', label: 'Skin Type', emoji: '🧴' },
  { value: 'hair_type', label: 'Hair Type', emoji: '💇' },
  { value: 'food_preferences', label: 'Food Preferences', emoji: '🍱' },
  { value: 'lifestyle', label: 'Lifestyle', emoji: '🧘' },
  { value: 'genre_preferences', label: 'Genre Preferences', emoji: '🎬' },
  { value: 'goals', label: 'Goals', emoji: '🎯' },
  { value: 'custom', label: 'Custom Category', emoji: '➕' },
];

const AddCustomPreferenceModal: React.FC<AddCustomPreferenceModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [category, setCategory] = useState<CanonicalCategory | 'custom' | ''>('');
  const [customCategory, setCustomCategory] = useState('');
  const [value, setValue] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCategory('');
      setCustomCategory('');
      setValue('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetField = category === 'custom' ? customCategory.trim().toLowerCase() : category;
    
    if (!targetField || !value.trim()) return;

    const preferenceValue = createPreferenceValue(value.trim(), 'manual', 'like');
    
    onSave(targetField as CanonicalCategory | string, preferenceValue);
    onClose();
  };

  const isValid = value.trim() && (
    (category && category !== 'custom') || 
    (category === 'custom' && customCategory.trim())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Preference</DialogTitle>
          <DialogDescription>
            Add a personal preference to help personalize your recommendations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select 
              value={category} 
              onValueChange={(val) => setCategory(val as CanonicalCategory | 'custom')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.emoji} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {category === 'custom' && (
              <Input
                placeholder="Enter custom category name"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Preference Value</Label>
            <Input
              id="value"
              placeholder="e.g., Oily skin, Vegetarian, Sci-Fi movies"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enter your specific preference
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Add Preference
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomPreferenceModal;
