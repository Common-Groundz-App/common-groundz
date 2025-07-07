import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export const getEntityById = async (entityId: string): Promise<Database["public"]["Tables"]["entities"]["Row"] | null> => {
  const { data, error } = await supabase
    .from('entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (error) {
    console.error('Error fetching entity:', error);
    return null;
  }

  return data;
};
