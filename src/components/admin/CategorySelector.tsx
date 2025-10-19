import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { fetchCategoriesByType } from '@/services/categoryService';
import { EntityType } from '@/services/recommendation/types';
import { getCanonicalType, getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { Loader2 } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { CategorySelectorDrillDown } from './CategorySelectorDrillDown';

// Export Category type for reuse by callers
export type Category = Database['public']['Tables']['categories']['Row'];

interface CategorySelectorProps {
  // ✅ STRICT: Only accept EntityType enum, not arbitrary strings
  entityType: EntityType;
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  showNoCategoryOption?: boolean;
  disabled?: boolean;
  className?: string;
  mode?: 'flat' | 'drill-down'; // NEW: Support both UX patterns
  filterByEntityType?: string; // NEW: Filter categories by entity type
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  entityType,
  value,
  onChange,
  label = 'Primary Category',
  placeholder = 'Select category',
  required = false,
  showNoCategoryOption = true,
  disabled = false,
  className = '',
  mode = 'flat', // Default to current flat dropdown behavior
  filterByEntityType
}) => {
  // Conditionally render drill-down mode
  if (mode === 'drill-down') {
    return (
      <CategorySelectorDrillDown
        entityType={entityType}
        value={value}
        onChange={onChange}
        label={label}
        placeholder={placeholder}
        required={required}
        showNoCategoryOption={showNoCategoryOption}
        disabled={disabled}
        className={className}
      />
    );
  }
  
  // Continue with flat dropdown mode below
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadCategories = async () => {
      if (!entityType && !filterByEntityType) {
        setCategories([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Use filterByEntityType if provided, otherwise use entityType
        const typeToFetch = filterByEntityType || entityType;
        const canonicalType = getCanonicalType(typeToFetch);
        
        const data = await fetchCategoriesByType(canonicalType);
        setCategories(data);
      } catch (err) {
        console.error('Error loading categories:', err);
        setError('Failed to load categories');
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadCategories();
  }, [entityType, filterByEntityType]);
  
  const getPlaceholderText = () => {
    if (loading) return 'Loading categories...';
    if (error) return 'Error loading categories';
    if (categories.length === 0) return 'No categories available';
    return placeholder;
  };
  
  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="category-select">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <Select
        value={value || '_none_'}
        onValueChange={(val) => onChange(val === '_none_' ? null : val)}
        disabled={disabled || loading}
      >
        <SelectTrigger id="category-select" className="w-full">
          <SelectValue placeholder={getPlaceholderText()} />
          {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        </SelectTrigger>
        
        <SelectContent>
          {showNoCategoryOption && !required && (
            <SelectItem value="_none_">No Category</SelectItem>
          )}
          
          {categories.length === 0 && !loading && !error && (
            <SelectItem value="_empty_" disabled>
              No categories available for {getEntityTypeLabel(entityType)}
            </SelectItem>
          )}
          
          {categories.map(cat => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.parent_id ? `↳ ${cat.name}` : cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {!required && !error && (
        <p className="text-xs text-muted-foreground">
          Entities without categories will be flagged for admin review
        </p>
      )}
      
      {error && (
        <p className="text-xs text-destructive">
          {error}. Please try again or contact support.
        </p>
      )}
    </div>
  );
};
