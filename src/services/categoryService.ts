import { supabase } from '@/integrations/supabase/client';
import { mapEntityTypeToString } from '@/hooks/feed/api/types';
import { Database } from '@/integrations/supabase/types';
import { EntityType } from '@/services/recommendation/types';
import { getCanonicalType } from '@/services/entityTypeHelpers';

type Category = Database['public']['Tables']['categories']['Row'];
type DatabaseEntityType = Database['public']['Enums']['entity_type'];

/**
 * Constant for the "Uncategorized" category ID
 * This category should be hidden in the UI and show entity type instead
 */
export const UNCATEGORIZED_CATEGORY_ID = 'f47565ec-5d6e-470d-9b76-6a08fc911204';

/**
 * Helper function to check if a category should be hidden from display
 * Returns true for the "Uncategorized" category
 */
export const shouldHideCategory = (categoryId: string | null | undefined): boolean => {
  return categoryId === UNCATEGORIZED_CATEGORY_ID;
};

/**
 * Extended category type with children info preloaded via join
 */
export interface CategoryWithChildren extends Category {
  has_children: boolean;
  children?: { id: string }[] | null; // Supabase join result
}

export const fetchCategoriesByType = async (
  entityType: EntityType | string
): Promise<Category[]> => {
  // ✅ Canonicalize to handle legacy types
  const canonicalType = getCanonicalType(
    typeof entityType === 'string' ? entityType : entityType
  );
  
  const mappedType = mapEntityTypeToString(canonicalType as any) as DatabaseEntityType;
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('entity_type', mappedType)
    .order('name');
  
  if (error) throw error;
  return data || [];
};

export const fetchCategoryTree = async (
  entityType: string
): Promise<Category[]> => {
  const mappedType = mapEntityTypeToString(entityType as any) as DatabaseEntityType;
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('entity_type', mappedType)
    .is('parent_id', null)
    .order('name');
  
  if (error) throw error;
  return data || [];
};

export const fetchAllCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data || [];
};

/**
 * Recursively fetch all parent categories for a given category
 * Returns array ordered from root to leaf: [grandparent, parent, child]
 */
export const getCategoryPath = async (
  categoryId: string
): Promise<Category[]> => {
  const path: Category[] = [];
  let currentId: string | null = categoryId;
  
  while (currentId) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', currentId)
      .single();
    
    if (error || !data) break;
    
    path.unshift(data); // Add to beginning of array
    currentId = data.parent_id;
  }
  
  return path;
};

/**
 * Get formatted breadcrumb string for a category
 * Example: "Apps & Software > Productivity Apps"
 */
export const getCategoryBreadcrumb = async (
  categoryId: string
): Promise<string> => {
  const path = await getCategoryPath(categoryId);
  return path.map(c => c.name).join(' > ');
};

/**
 * Fetch children of a specific category with has_children flag preloaded
 * Uses Supabase join to avoid N+1 queries
 */
export const fetchCategoryChildren = async (
  entityType: EntityType | string,
  parentId: string | null = null
): Promise<CategoryWithChildren[]> => {
  const canonicalType = getCanonicalType(
    typeof entityType === 'string' ? entityType : entityType
  );
  const mappedType = mapEntityTypeToString(canonicalType as any) as DatabaseEntityType;
  
  const query = supabase
    .from('categories')
    .select(`
      *,
      children:categories!parent_id(id)
    `)
    .eq('entity_type', mappedType)
    .order('name');
  
  if (parentId === null) {
    query.is('parent_id', null);
  } else {
    query.eq('parent_id', parentId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  // Transform data to add has_children flag
  // Note: Supabase returns children: null when no descendants exist
  return (data || []).map((cat: any) => ({
    ...cat,
    has_children: Array.isArray(cat.children) && cat.children.length > 0
  }));
};

/**
 * Check if a category has children
 */
export const categoryHasChildren = async (
  categoryId: string
): Promise<boolean> => {
  const { count, error } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', categoryId);
  
  if (error) return false;
  return (count || 0) > 0;
};
