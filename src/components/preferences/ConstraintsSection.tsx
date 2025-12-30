import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus, Ban } from 'lucide-react';
import { 
  UnifiedConstraint, 
  UnifiedConstraintsType,
} from '@/types/preferences';
import {
  CONSTRAINT_CATEGORIES,
  getConstraintsForCategory,
  getIntentStyles,
  getScopeLabel,
  countConstraints,
  getPrimaryCategory,
  ConstraintCategory,
} from '@/utils/constraintUtils';
import { cn } from '@/lib/utils';

// Constraint chip component - rose-toned, clean style
// Hides scope label when rendered inside its primary category
const ConstraintChip = ({ 
  constraint,
  onRemove, 
  disabled = false,
  currentCategory,
}: { 
  constraint: UnifiedConstraint;
  onRemove: (id: string) => void;
  disabled?: boolean;
  currentCategory?: string;
}) => {
  const intentStyles = getIntentStyles(constraint.intent);
  const primaryCategory = getPrimaryCategory(constraint);
  
  // Only show scope if it's domain-specific AND different from current context
  const showScope = constraint.scope !== 'global' && 
                    constraint.scope !== currentCategory &&
                    constraint.scope !== primaryCategory;
  
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
      {showScope && (
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
      </h4>
      <div className="flex flex-wrap gap-1.5">
        {constraints.map((constraint) => (
          <ConstraintChip
            key={constraint.id}
            constraint={constraint}
            onRemove={onRemoveConstraint}
            disabled={isReadOnly}
            currentCategory={category.id}
          />
        ))}
      </div>
    </div>
  );
};

interface ConstraintsSectionProps {
  constraints: UnifiedConstraintsType;
  onUpdateConstraints: (constraints: UnifiedConstraintsType) => void;
  isReadOnly?: boolean;
  onOpenModal?: () => void;
}

const ConstraintsSection: React.FC<ConstraintsSectionProps> = ({
  constraints,
  onUpdateConstraints,
  isReadOnly = false,
  onOpenModal,
}) => {
  // Use unified format directly (legacy migration handled at context level)
  const unifiedConstraints: UnifiedConstraintsType = constraints || { items: [] };
  
  
  // Handler for removing constraint
  const handleRemoveConstraint = (id: string) => {
    const updated: UnifiedConstraintsType = {
      ...unifiedConstraints,
      items: unifiedConstraints.items.filter(c => c.id !== id),
    };
    onUpdateConstraints(updated);
  };
  
  // Get categories that have constraints (using primary category - no duplication)
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
        </div>
      ) : (
        <div className="text-center py-6 bg-accent/20 rounded-lg">
          <Ban className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Nothing to avoid yet
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Add things you'd like to avoid in recommendations
          </p>
          {!isReadOnly && onOpenModal && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onOpenModal}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Something to Avoid
            </Button>
          )}
        </div>
      )}

    </div>
  );
};

export default ConstraintsSection;
