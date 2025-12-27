import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  UnifiedConstraint, 
  ConstraintTargetType, 
  ConstraintScope,
  UnifiedConstraintIntent 
} from '@/types/preferences';
import { 
  createUnifiedConstraint, 
  detectConstraintType, 
  getTargetTypeLabel, 
  getScopeLabel,
  CONSTRAINT_CATEGORIES
} from '@/utils/constraintUtils';
import { Ban, AlertCircle, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddUnifiedConstraintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (constraint: UnifiedConstraint) => void;
}

const AddUnifiedConstraintModal: React.FC<AddUnifiedConstraintModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [input, setInput] = useState('');
  const [detectedType, setDetectedType] = useState<ConstraintTargetType>('rule');
  const [detectedScope, setDetectedScope] = useState<ConstraintScope>('global');
  const [confidence, setConfidence] = useState(0.5);
  const [intent, setIntent] = useState<UnifiedConstraintIntent>('avoid');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [manualType, setManualType] = useState<ConstraintTargetType | null>(null);
  const [manualScope, setManualScope] = useState<ConstraintScope | null>(null);

  // Detect type as user types
  useEffect(() => {
    if (input.trim()) {
      const detected = detectConstraintType(input);
      setDetectedType(detected.targetType);
      setDetectedScope(detected.scope);
      setConfidence(detected.confidence);
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    const finalType = manualType ?? detectedType;
    const finalScope = manualScope ?? detectedScope;

    const constraint = createUnifiedConstraint(finalType, input.trim(), {
      scope: finalScope,
      intent,
      source: 'manual',
    });

    onSave(constraint);
    handleClose();
  };

  const handleClose = () => {
    setInput('');
    setShowAdvanced(false);
    setManualType(null);
    setManualScope(null);
    setIntent('avoid');
    onClose();
  };

  const finalType = manualType ?? detectedType;
  const finalScope = manualScope ?? detectedScope;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-rose-500" />
            Add Constraint
          </DialogTitle>
          <DialogDescription>
            Tell us what you want to avoid, and we'll make sure it's respected in recommendations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Input */}
          <div className="space-y-2">
            <Label htmlFor="constraint-input">What do you want to avoid?</Label>
            <Input
              id="constraint-input"
              placeholder="e.g., vitamin C, horror movies, fast food, gels..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
              className="text-base"
            />
          </div>

          {/* AI Detection Preview */}
          {input.trim() && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>Detected as:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">
                  {getTargetTypeLabel(finalType)}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                  {getScopeLabel(finalScope)}
                </Badge>
                {confidence < 0.7 && (
                  <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Low confidence
                  </Badge>
                )}
              </div>
              
              {/* Adjust button */}
              {!showAdvanced && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Adjust detection
                </button>
              )}
            </div>
          )}

          {/* Advanced Options (hidden by default) */}
          {showAdvanced && input.trim() && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Override detection:</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={manualType ?? detectedType} onValueChange={(v) => setManualType(v as ConstraintTargetType)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingredient">Ingredient</SelectItem>
                      <SelectItem value="brand">Brand</SelectItem>
                      <SelectItem value="genre">Genre</SelectItem>
                      <SelectItem value="food_type">Food Type</SelectItem>
                      <SelectItem value="format">Format</SelectItem>
                      <SelectItem value="rule">General Rule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <Label className="text-xs">Applies to</Label>
                  <Select value={manualScope ?? detectedScope} onValueChange={(v) => setManualScope(v as ConstraintScope)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">All categories</SelectItem>
                      <SelectItem value="skincare">Skincare only</SelectItem>
                      <SelectItem value="haircare">Haircare only</SelectItem>
                      <SelectItem value="food">Food only</SelectItem>
                      <SelectItem value="entertainment">Entertainment only</SelectItem>
                      <SelectItem value="supplements">Supplements only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Intent Selection */}
          <div className="space-y-2">
            <Label>How strict?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIntent('avoid')}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                  intent === 'avoid'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                <AlertCircle className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Avoid</p>
                  <p className="text-xs text-muted-foreground">Unless I ask</p>
                </div>
                {intent === 'avoid' && <Check className="h-4 w-4" />}
              </button>
              
              <button
                type="button"
                onClick={() => setIntent('strictly_avoid')}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border text-left transition-all',
                  intent === 'strictly_avoid'
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                <Ban className="h-4 w-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Never</p>
                  <p className="text-xs text-muted-foreground">Even if I ask</p>
                </div>
                {intent === 'strictly_avoid' && <Check className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!input.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Add Constraint
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUnifiedConstraintModal;
