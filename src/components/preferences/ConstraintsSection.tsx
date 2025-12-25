import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, X } from 'lucide-react';
import { CustomConstraint, ConstraintsType, INTENT_COLORS } from '@/types/preferences';
import TagInput from './TagInput';
import AddCustomConstraintModal from './AddCustomConstraintModal';
import { cn } from '@/lib/utils';

// Constraint chip component - firmer style than preferences
const ConstraintChip = ({ 
  value, 
  onRemove, 
  disabled = false 
}: { 
  value: string; 
  onRemove: () => void;
  disabled?: boolean;
}) => (
  <div 
    className={cn(
      "rounded-full py-1.5 px-3 text-xs flex items-center gap-1.5 group transition-all",
      "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300",
      "border border-rose-200/60 dark:border-rose-800/40"
    )}
  >
    <span>{value}</span>
    <button 
      onClick={onRemove}
      disabled={disabled}
      className={cn(
        "opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-0.5",
        "hover:bg-rose-200 dark:hover:bg-rose-800",
        disabled && "cursor-not-allowed opacity-30"
      )}
    >
      <X className="h-3 w-3" />
    </button>
  </div>
);

interface ConstraintsSectionProps {
  constraints: ConstraintsType;
  onUpdateConstraints: (constraints: ConstraintsType) => void;
  isReadOnly?: boolean;
}

const ConstraintsSection: React.FC<ConstraintsSectionProps> = ({
  constraints,
  onUpdateConstraints,
  isReadOnly = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<CustomConstraint | null>(null);

  const handleIngredientsChange = (ingredients: string[]) => {
    onUpdateConstraints({
      ...constraints,
      avoidIngredients: ingredients
    });
  };

  const handleBrandsChange = (brands: string[]) => {
    onUpdateConstraints({
      ...constraints,
      avoidBrands: brands
    });
  };

  const handleProductFormsChange = (forms: string[]) => {
    onUpdateConstraints({
      ...constraints,
      avoidProductForms: forms
    });
  };

  const handleBudgetChange = (budget: string) => {
    onUpdateConstraints({
      ...constraints,
      budget: budget as ConstraintsType['budget']
    });
  };

  const handleAddCustomConstraint = (constraint: Omit<CustomConstraint, 'id' | 'createdAt'>) => {
    const newConstraint: CustomConstraint = {
      ...constraint,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    onUpdateConstraints({
      ...constraints,
      custom: [...(constraints.custom || []), newConstraint]
    });
    setIsModalOpen(false);
  };

  const handleUpdateCustomConstraint = (updatedConstraint: CustomConstraint) => {
    onUpdateConstraints({
      ...constraints,
      custom: (constraints.custom || []).map(c => 
        c.id === updatedConstraint.id ? updatedConstraint : c
      )
    });
    setEditingConstraint(null);
    setIsModalOpen(false);
  };

  const handleRemoveCustomConstraint = (id: string) => {
    onUpdateConstraints({
      ...constraints,
      custom: (constraints.custom || []).filter(c => c.id !== id)
    });
  };

  // Group custom constraints by category
  const groupedConstraints = (constraints.custom || []).reduce((acc, constraint) => {
    if (!acc[constraint.category]) acc[constraint.category] = [];
    acc[constraint.category].push(constraint);
    return acc;
  }, {} as Record<string, CustomConstraint[]>);

  return (
    <div className="space-y-6">
      {/* Hardcoded Constraints */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Exclude Ingredients</Label>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidIngredients || []}
              onChange={handleIngredientsChange}
              placeholder="Add ingredient..."
            />
          )}
          {isReadOnly && (constraints.avoidIngredients?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {constraints.avoidIngredients?.map(item => (
                <ConstraintChip key={item} value={item} onRemove={() => {}} disabled />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Exclude Brands</Label>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidBrands || []}
              onChange={handleBrandsChange}
              placeholder="Add brand..."
            />
          )}
          {isReadOnly && (constraints.avoidBrands?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {constraints.avoidBrands?.map(item => (
                <ConstraintChip key={item} value={item} onRemove={() => {}} disabled />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Exclude Formats</Label>
          <p className="text-xs text-muted-foreground mb-2">e.g., sprays, gels, powders</p>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidProductForms || []}
              onChange={handleProductFormsChange}
              placeholder="Add product form..."
            />
          )}
          {isReadOnly && (constraints.avoidProductForms?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {constraints.avoidProductForms?.map(item => (
                <ConstraintChip key={item} value={item} onRemove={() => {}} disabled />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Budget Preference</Label>
          <p className="text-xs text-muted-foreground mb-2">Only recommend products within this range</p>
          <Select 
            value={constraints.budget || 'no_preference'} 
            onValueChange={handleBudgetChange}
            disabled={isReadOnly}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select budget" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no_preference">No preference</SelectItem>
              <SelectItem value="affordable">Affordable (Budget-friendly)</SelectItem>
              <SelectItem value="mid-range">Mid-range</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Custom Constraints */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-medium">Custom Constraints</Label>
            <p className="text-xs text-muted-foreground">Add any other restrictions or preferences</p>
          </div>
          {!isReadOnly && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsModalOpen(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Custom
            </Button>
          )}
        </div>

        {Object.keys(groupedConstraints).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(groupedConstraints).map(([category, categoryConstraints]) => (
              <div key={category} className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {category}
                </span>
                <div className="space-y-2">
                  {categoryConstraints.map((constraint) => {
                    const intentStyle = INTENT_COLORS[constraint.intent];
                    return (
                      <div 
                        key={constraint.id}
                        className="flex items-center justify-between p-3 bg-accent/30 rounded-lg"
                      >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge 
                            variant="outline" 
                            className={cn(intentStyle.bg, intentStyle.text, 'text-xs')}
                          >
                            {intentStyle.label}
                          </Badge>
                          {constraint.source === 'chatbot' && (
                            <Badge 
                              variant="outline" 
                              className="text-xs bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20"
                            >
                              AI
                            </Badge>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {constraint.rule}: {constraint.value}
                            </p>
                            {constraint.evidence && (
                              <p className="text-xs text-muted-foreground truncate">
                                "{constraint.evidence}"
                              </p>
                            )}
                          </div>
                        </div>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveCustomConstraint(constraint.id)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-accent/20 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No custom constraints yet. Add rules like "Avoid horror movies" or "Prefer organic products".
            </p>
          </div>
        )}
      </div>

      <AddCustomConstraintModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConstraint(null);
        }}
        onSave={editingConstraint ? handleUpdateCustomConstraint : handleAddCustomConstraint}
        initialConstraint={editingConstraint}
      />
    </div>
  );
};

export default ConstraintsSection;
