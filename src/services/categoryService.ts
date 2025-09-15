/**
 * Category service for Phase 1 entity architecture
 */

import { supabase } from '@/integrations/supabase/client';
import { Category, CategoryHierarchy } from '@/types/categories';

export const getCategoryHierarchy = async (): Promise<CategoryHierarchy[]> => {
  const { data, error } = await supabase.rpc('get_category_hierarchy');
  
  if (error) {
    console.error('Error fetching category hierarchy:', error);
    throw error;
  }
  
  // Transform the data to match our interface
  return (data || []).map((item: any) => ({
    ...item,
    subcategories: Array.isArray(item.subcategories) ? item.subcategories : []
  }));
};

export const getCategoriesByParent = async (parentId?: string): Promise<Category[]> => {
  const { data, error } = await supabase.rpc('get_categories_by_parent', {
    parent_uuid: parentId || null
  });
  
  if (error) {
    console.error('Error fetching categories by parent:', error);
    throw error;
  }
  
  return data || [];
};

export const searchCategories = async (query: string): Promise<Category[]> => {
  const { data, error } = await supabase.rpc('search_categories', {
    search_query: query
  });
  
  if (error) {
    console.error('Error searching categories:', error);
    throw error;
  }
  
  return data || [];
};

export const getMainCategories = async (): Promise<Category[]> => {
  return getCategoriesByParent();
};

export const getSubcategories = async (parentId: string): Promise<Category[]> => {
  return getCategoriesByParent(parentId);
};