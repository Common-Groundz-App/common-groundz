import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Shield } from 'lucide-react';
import { CustomConstraint, ConstraintsType, INTENT_COLORS } from '@/types/preferences';
import TagInput from './TagInput';
import AddCustomConstraintModal from './AddCustomConstraintModal';
import { cn } from '@/lib/utils';

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
      {/* Header with warning */}
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
        <Shield className="h-5 w-5 text-red-500" />
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          Constraints are NEVER violated by AI recommendations
        </span>
      </div>

      {/* Hardcoded Constraints */}
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Ingredients to Avoid</Label>
          <p className="text-xs text-muted-foreground mb-2">Products with these ingredients will never be recommended</p>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidIngredients || []}
              onChange={handleIngredientsChange}
              placeholder="Add ingredient..."
            />
          )}
          {isReadOnly && (constraints.avoidIngredients?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {constraints.avoidIngredients?.map(item => (
                <Badge key={item} variant="outline" className="bg-red-500/10 text-red-600">{item}</Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Brands to Avoid</Label>
          <p className="text-xs text-muted-foreground mb-2">Products from these brands will never be recommended</p>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidBrands || []}
              onChange={handleBrandsChange}
              placeholder="Add brand..."
            />
          )}
          {isReadOnly && (constraints.avoidBrands?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {constraints.avoidBrands?.map(item => (
                <Badge key={item} variant="outline" className="bg-red-500/10 text-red-600">{item}</Badge>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <Label className="text-sm font-medium">Product Forms to Avoid</Label>
          <p className="text-xs text-muted-foreground mb-2">e.g., sprays, gels, powders</p>
          {!isReadOnly && (
            <TagInput
              tags={constraints.avoidProductForms || []}
              onChange={handleProductFormsChange}
              placeholder="Add product form..."
            />
          )}
          {isReadOnly && (constraints.avoidProductForms?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {constraints.avoidProductForms?.map(item => (
                <Badge key={item} variant="outline" className="bg-red-500/10 text-red-600">{item}</Badge>
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
