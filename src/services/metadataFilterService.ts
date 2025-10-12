import { supabase } from '@/integrations/supabase/client';
import { mapEntityTypeToString } from '@/hooks/feed/api/types';
import { Entity } from './recommendation/types';
import { Database } from '@/integrations/supabase/types';

type DatabaseEntityType = Database['public']['Enums']['entity_type'];

interface MetadataFilter {
  key: string;
  value: any;
  operator?: 'eq' | 'contains' | 'gt' | 'lt';
}

export const queryEntitiesByMetadata = async (
  type: string,
  filters: MetadataFilter[]
): Promise<Entity[]> => {
  const mappedType = mapEntityTypeToString(type as any) as DatabaseEntityType;
  
  // Build base query
  const baseQuery = supabase
    .from('entities')
    .select('*')
    .eq('type', mappedType)
    .eq('is_deleted', false);
  
  // Apply filters using filter method to avoid type issues
  let finalQuery: any = baseQuery;
  filters.forEach(filter => {
    const path = `metadata->${filter.key}`;
    if (filter.operator === 'contains') {
      finalQuery = finalQuery.filter(path, 'cs', JSON.stringify(filter.value));
    } else if (filter.operator === 'gt') {
      finalQuery = finalQuery.filter(path, 'gt', filter.value);
    } else if (filter.operator === 'lt') {
      finalQuery = finalQuery.filter(path, 'lt', filter.value);
    } else {
      finalQuery = finalQuery.filter(path, 'eq', filter.value);
    }
  });
  
  const { data, error } = await finalQuery;
  if (error) throw error;
  return data as Entity[];
};

export const searchByMetadataField = async (
  type: string,
  fieldKey: string,
  searchValue: string
): Promise<Entity[]> => {
  const mappedType = mapEntityTypeToString(type as any) as DatabaseEntityType;
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('type', mappedType)
    .eq('is_deleted', false)
    .ilike(`metadata->>${fieldKey}`, `%${searchValue}%`);
  
  if (error) throw error;
  return data as Entity[];
};
