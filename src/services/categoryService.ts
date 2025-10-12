import { supabase } from '@/integrations/supabase/client';
import { mapEntityTypeToString } from '@/hooks/feed/api/types';
import { Database } from '@/integrations/supabase/types';

type Category = Database['public']['Tables']['categories']['Row'];
type DatabaseEntityType = Database['public']['Enums']['entity_type'];

export const fetchCategoriesByType = async (
  entityType: string
): Promise<Category[]> => {
  const mappedType = mapEntityTypeToString(entityType as any) as DatabaseEntityType;
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
