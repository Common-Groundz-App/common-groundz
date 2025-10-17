import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { fetchCategoryChildren, getCategoryPath, categoryHasChildren } from '@/services/categoryService';
import { EntityType } from '@/services/recommendation/types';
import { getCanonicalType, getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { cn } from '@/lib/utils';
import { Database } from '@/integrations/supabase/types';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategorySelectorDrillDownProps {
  entityType: EntityType;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showNoCategoryOption?: boolean;
  disabled?: boolean;
  className?: string;
}

export const CategorySelectorDrillDown: React.FC<CategorySelectorDrillDownProps> = ({
  entityType,
  value,
  onChange,
  label = 'Primary Category',
  placeholder = 'Select category',
  required = false,
  showNoCategoryOption = true,
  disabled = false,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [currentParent, setCurrentParent] = useState<string | null>(null);
  const [navigationStack, setNavigationStack] = useState<Category[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesWithChildren, setCategoriesWithChildren] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<Category[]>([]);

  // Load categories for current level
  useEffect(() => {
    const loadCategories = async () => {
      if (!entityType) return;
      
      setLoading(true);
      try {
        const canonicalType = getCanonicalType(entityType);
        const data = await fetchCategoryChildren(canonicalType, currentParent);
        setCategories(data);
        
        // Check which categories have children
        const hasChildrenSet = new Set<string>();
        await Promise.all(
          data.map(async (cat) => {
            const hasChildren = await categoryHasChildren(cat.id);
            if (hasChildren) {
              hasChildrenSet.add(cat.id);
            }
          })
        );
        setCategoriesWithChildren(hasChildrenSet);
      } catch (err) {
        console.error('Error loading categories:', err);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, [entityType, currentParent]);

  // Load selected category path on mount
  useEffect(() => {
    const loadSelectedPath = async () => {
      if (value) {
        try {
          const path = await getCategoryPath(value);
          setSelectedPath(path);
        } catch (err) {
          console.error('Error loading category path:', err);
        }
      } else {
        setSelectedPath([]);
      }
    };
    
    loadSelectedPath();
  }, [value]);

  // Navigate into subcategories
  const handleDrillDown = (category: Category, e: React.MouseEvent) => {
    e.stopPropagation();
    setNavigationStack([...navigationStack, category]);
    setCurrentParent(category.id);
  };

  // Navigate back to parent level
  const handleDrillUp = () => {
    const newStack = [...navigationStack];
    newStack.pop();
    setNavigationStack(newStack);
    setCurrentParent(newStack.length > 0 ? newStack[newStack.length - 1].id : null);
  };

  // Select a category
  const handleSelect = (category: Category) => {
    onChange(category.id);
    setOpen(false);
    // Reset navigation
    setCurrentParent(null);
    setNavigationStack([]);
  };

  // Clear selection
  const handleClear = () => {
    onChange(null);
    setOpen(false);
    setCurrentParent(null);
    setNavigationStack([]);
  };

  // Reset navigation when popover closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setCurrentParent(null);
      setNavigationStack([]);
    }
  };

  // Get display value
  const getDisplayValue = () => {
    if (!value || selectedPath.length === 0) return placeholder;
    return selectedPath.map(c => c.name).join(' > ');
  };

  // Get breadcrumb for current navigation
  const getCurrentBreadcrumb = () => {
    if (navigationStack.length === 0) return getEntityTypeLabel(entityType);
    return navigationStack.map(c => c.name).join(' > ');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            <span className="truncate">{getDisplayValue()}</span>
            <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            {/* Breadcrumb header with back button */}
            <div className="flex items-center border-b px-3 py-2 bg-muted/50">
              {navigationStack.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDrillUp}
                  className="mr-2 h-8 w-8 p-0 hover:bg-muted"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <span className="text-sm font-medium truncate">
                {getCurrentBreadcrumb()}
              </span>
            </div>

            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {!loading && categories.length === 0 && (
                <CommandEmpty>No categories found.</CommandEmpty>
              )}
              
              {!loading && (
                <CommandGroup>
                  {/* Show "No Category" option at root level */}
                  {showNoCategoryOption && !required && navigationStack.length === 0 && (
                    <CommandItem
                      onSelect={handleClear}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                      No Category
                    </CommandItem>
                  )}
                  
                  {categories.map((category) => {
                    const isSelected = value === category.id;
                    const hasChildren = categoriesWithChildren.has(category.id);
                    
                    return (
                      <CommandItem
                        key={category.id}
                        onSelect={() => handleSelect(category)}
                        className="cursor-pointer justify-between"
                      >
                        <div className="flex items-center flex-1">
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{category.name}</span>
                        </div>
                        
                        {/* Drill-down arrow (click to navigate, not select) */}
                        {hasChildren && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2 shrink-0 hover:bg-muted"
                            onClick={(e) => handleDrillDown(category, e)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {!required && (
        <p className="text-xs text-muted-foreground">
          Entities without categories will be flagged for admin review
        </p>
      )}
    </div>
  );
};
