import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomPreference, PREFERENCE_CATEGORIES } from '@/types/preferences';

interface AddCustomPreferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preference: Omit<CustomPreference, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialPreference?: CustomPreference | null;
}

const EXAMPLE_KEYS = [
  'Texture preference',
  'Reading time',
  'Workout duration',
  'Spice level',
  'Viewing mood',
  'Learning style',
];

const AddCustomPreferenceModal: React.FC<AddCustomPreferenceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPreference
}) => {
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (initialPreference) {
      setCategory(initialPreference.category);
      setKey(initialPreference.key);
      setValue(initialPreference.value);
    } else {
      setCategory('');
      setCustomCategory('');
      setKey('');
      setValue('');
    }
  }, [initialPreference, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCategory = category === 'other' ? customCategory : category;
    
    if (!finalCategory || !key || !value) return;

    onSave({
      category: finalCategory,
      key,
      value,
      source: 'manual',
      confidence: 1.0,
      priority: 'user',
    });
    
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialPreference ? 'Edit Preference' : 'Add Custom Preference'}
          </DialogTitle>
          <DialogDescription>
            Add a personal preference that helps the AI personalize recommendations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {PREFERENCE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {category === 'other' && (
              <Input
                placeholder="Enter custom category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Key/Label */}
          <div className="space-y-2">
            <Label htmlFor="key">Label</Label>
            <Input
              id="key"
              placeholder="e.g., Texture preference, Reading time"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              list="key-examples"
            />
            <datalist id="key-examples">
              {EXAMPLE_KEYS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              What aspect of your preference is this?
            </p>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              placeholder="e.g., Lightweight, Morning, 30 minutes"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your specific preference
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!category || !key || !value || (category === 'other' && !customCategory)}
            >
              {initialPreference ? 'Update' : 'Add Preference'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomPreferenceModal;
