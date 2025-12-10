import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomConstraint, ConstraintIntent, INTENT_COLORS, PREFERENCE_CATEGORIES } from '@/types/preferences';
import { AlertTriangle, Ban, Scale, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddCustomConstraintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (constraint: Omit<CustomConstraint, 'id' | 'createdAt'> | CustomConstraint) => void;
  initialConstraint?: CustomConstraint | null;
}

const INTENT_OPTIONS: { value: ConstraintIntent; label: string; description: string; icon: React.ReactNode }[] = [
  { 
    value: 'strictly_avoid', 
    label: 'Strictly Avoid', 
    description: 'Never recommend, even if I ask',
    icon: <Ban className="h-4 w-4 text-red-500" />
  },
  { 
    value: 'avoid', 
    label: 'Avoid', 
    description: 'Try not to recommend, unless I specifically request',
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />
  },
  { 
    value: 'limit', 
    label: 'Limit', 
    description: 'Only recommend with good reason',
    icon: <Scale className="h-4 w-4 text-yellow-500" />
  },
  { 
    value: 'prefer', 
    label: 'Prefer', 
    description: 'Prioritize this when relevant',
    icon: <Heart className="h-4 w-4 text-green-500" />
  },
];

const EXAMPLE_RULES = [
  'Avoid genre',
  'Avoid after time',
  'Avoid type',
  'Prefer format',
  'Limit duration',
  'Avoid content with',
  'Prefer rating above',
];

const AddCustomConstraintModal: React.FC<AddCustomConstraintModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialConstraint
}) => {
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [rule, setRule] = useState('');
  const [value, setValue] = useState('');
  const [intent, setIntent] = useState<ConstraintIntent>('avoid');

  useEffect(() => {
    if (initialConstraint) {
      setCategory(initialConstraint.category);
      setRule(initialConstraint.rule);
      setValue(initialConstraint.value);
      setIntent(initialConstraint.intent);
    } else {
      setCategory('');
      setCustomCategory('');
      setRule('');
      setValue('');
      setIntent('avoid');
    }
  }, [initialConstraint, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCategory = category === 'other' ? customCategory : category;
    
    if (!finalCategory || !rule || !value) return;

    const constraint = {
      category: finalCategory,
      rule,
      value,
      intent,
      source: 'manual' as const,
      confidence: 1.0,
      ...(initialConstraint && { 
        id: initialConstraint.id, 
        createdAt: initialConstraint.createdAt 
      })
    };

    onSave(constraint as any);
    onClose();
  };

  const selectedIntentStyle = INTENT_COLORS[intent];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialConstraint ? 'Edit Constraint' : 'Add Custom Constraint'}
          </DialogTitle>
          <DialogDescription>
            Create a rule that the AI will always respect in recommendations.
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

          {/* Rule */}
          <div className="space-y-2">
            <Label htmlFor="rule">Rule</Label>
            <Input
              id="rule"
              placeholder="e.g., Avoid genre, Prefer format"
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              list="rule-examples"
            />
            <datalist id="rule-examples">
              {EXAMPLE_RULES.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Describe the type of constraint (e.g., "Avoid genre", "Prefer format")
            </p>
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              placeholder="e.g., horror, paperback, after 10pm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The specific thing to avoid, prefer, or limit
            </p>
          </div>

          {/* Intent */}
          <div className="space-y-2">
            <Label>Intent Level</Label>
            <div className="grid grid-cols-2 gap-2">
              {INTENT_OPTIONS.map((option) => {
                const isSelected = intent === option.value;
                const style = INTENT_COLORS[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setIntent(option.value)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                      isSelected 
                        ? `${style.bg} border-current ${style.text}` 
                        : 'border-border hover:bg-accent/50'
                    )}
                  >
                    {option.icon}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium', isSelected && style.text)}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!category || !rule || !value || (category === 'other' && !customCategory)}
            >
              {initialConstraint ? 'Update' : 'Add Constraint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomConstraintModal;
