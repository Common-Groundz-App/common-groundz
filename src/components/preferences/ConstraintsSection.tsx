import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Ban, AlertCircle } from 'lucide-react';
import { 
  UnifiedConstraint, 
  UnifiedConstraintsType,
  ConstraintsType,
} from '@/types/preferences';
import {
  CONSTRAINT_CATEGORIES,
  getConstraintsForCategory,
  getIntentStyles,
  getScopeLabel,
  isLegacyConstraintFormat,
  migrateToUnifiedConstraints,
  countConstraints,
  ConstraintCategory,
} from '@/utils/constraintUtils';
import AddUnifiedConstraintModal from './AddUnifiedConstraintModal';
import { cn } from '@/lib/utils';

// Constraint chip component - rose-toned, clean style
const ConstraintChip = ({ 
  constraint,
  onRemove, 
  disabled = false 
}: { 
  constraint: UnifiedConstraint;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) => {
  const intentStyles = getIntentStyles(constraint.intent);
  
  return (
    <div 
      className={cn(
        "rounded-full py-1.5 px-3 text-xs flex items-center gap-1.5 group transition-all",
        intentStyles.bg,
        intentStyles.text,
        "border border-rose-200/60 dark:border-rose-800/40"
      )}
    >
      <span className="font-medium">{constraint.targetValue}</span>
      {constraint.scope !== 'global' && (
        <span className="opacity-60 text-[10px]">({getScopeLabel(constraint.scope)})</span>
      )}
      {constraint.source === 'chatbot' && (
        <span className="opacity-70 text-[10px]">🤖</span>
      )}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onRemove(constraint.id);
        }}
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
};

// Category card component (matches YP style)
const ConstraintCategoryCard = ({
  category,
  constraints,
  onRemoveConstraint,
  isReadOnly,
}: {
  category: ConstraintCategory;
  constraints: UnifiedConstraint[];
  onRemoveConstraint: (id: string) => void;
  isReadOnly: boolean;
}) => {
  if (constraints.length === 0) return null;
  
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <span>{category.emoji}</span>
        {category.name}
        <Badge variant="outline" className="text-xs bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
          {constraints.length}
        </Badge>
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {constraints.map((constraint) => (
          <ConstraintChip
            key={constraint.id}
            constraint={constraint}
            onRemove={onRemoveConstraint}
            disabled={isReadOnly}
          />
        ))}
      </div>
    </div>
  );
};

interface ConstraintsSectionProps {
  constraints: ConstraintsType | UnifiedConstraintsType;
  onUpdateConstraints: (constraints: ConstraintsType | UnifiedConstraintsType) => void;
  isReadOnly?: boolean;
}

const ConstraintsSection: React.FC<ConstraintsSectionProps> = ({
  constraints,
  onUpdateConstraints,
  isReadOnly = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Normalize to unified format (handles both legacy and new)
  const unifiedConstraints: UnifiedConstraintsType = isLegacyConstraintFormat(constraints)
    ? migrateToUnifiedConstraints(constraints as ConstraintsType)
    : (constraints as UnifiedConstraintsType) || { items: [], budget: 'no_preference' };
  
  // Handler for adding new constraint
  const handleAddConstraint = (constraint: UnifiedConstraint) => {
    const updated: UnifiedConstraintsType = {
      ...unifiedConstraints,
      items: [...unifiedConstraints.items, constraint],
    };
    onUpdateConstraints(updated);
    setIsModalOpen(false);
  };
  
  // Handler for removing constraint
  const handleRemoveConstraint = (id: string) => {
    const updated: UnifiedConstraintsType = {
      ...unifiedConstraints,
      items: unifiedConstraints.items.filter(c => c.id !== id),
    };
    onUpdateConstraints(updated);
  };
  
  // Handler for budget change
  const handleBudgetChange = (budget: string) => {
    const updated: UnifiedConstraintsType = {
      ...unifiedConstraints,
      budget: budget as UnifiedConstraintsType['budget'],
    };
    onUpdateConstraints(updated);
  };
  
  // Get categories that have constraints
  const categoriesWithConstraints = CONSTRAINT_CATEGORIES.map(category => ({
    category,
    constraints: getConstraintsForCategory(unifiedConstraints, category.id),
  })).filter(({ constraints }) => constraints.length > 0);
  
  const totalCount = countConstraints(unifiedConstraints);
  const hasAnyConstraints = totalCount > 0;
  
  return (
    <div className="space-y-4">
      {/* Category-based display */}
      {hasAnyConstraints ? (
        <div className="space-y-4">
          {categoriesWithConstraints.map(({ category, constraints }) => (
            <ConstraintCategoryCard
              key={category.id}
              category={category}
              constraints={constraints}
              onRemoveConstraint={handleRemoveConstraint}
              isReadOnly={isReadOnly}
            />
          ))}
          
          {/* Budget display (kept separate) */}
          {unifiedConstraints.budget && unifiedConstraints.budget !== 'no_preference' && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span>💰</span>
                Budget
              </h4>
              <div className="flex flex-wrap gap-1.5">
                <div className="rounded-full py-1.5 px-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                  {unifiedConstraints.budget === 'affordable' && 'Budget-friendly'}
                  {unifiedConstraints.budget === 'mid-range' && 'Mid-range'}
                  {unifiedConstraints.budget === 'premium' && 'Premium only'}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 bg-accent/20 rounded-lg">
          <Ban className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No constraints set yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Add things you want to avoid in recommendations
          </p>
          {!isReadOnly && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsModalOpen(true)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Constraint
            </Button>
          )}
        </div>
      )}
      
      {/* Budget selector (always visible when there are constraints) */}
      {hasAnyConstraints && (
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm flex items-center gap-2">
                <span>💰</span>
                Budget Preference
              </h4>
              <p className="text-xs text-muted-foreground">Filter by price range</p>
            </div>
            <Select 
              value={unifiedConstraints.budget || 'no_preference'} 
              onValueChange={handleBudgetChange}
              disabled={isReadOnly}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Any budget" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no_preference">No preference</SelectItem>
                <SelectItem value="affordable">Affordable</SelectItem>
                <SelectItem value="mid-range">Mid-range</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {/* Add constraint button (when there are existing constraints) */}
      {hasAnyConstraints && !isReadOnly && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsModalOpen(true)}
            className="text-muted-foreground hover:text-foreground gap-1"
          >
            <Plus className="h-4 w-4" />
            Add another constraint
          </Button>
        </div>
      )}

      <AddUnifiedConstraintModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddConstraint}
      />
    </div>
  );
};

export default ConstraintsSection;
