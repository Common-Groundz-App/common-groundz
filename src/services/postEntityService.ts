
import { supabase } from '@/integrations/supabase/client';

export const insertPostEntity = async (postId: string, entityId: string) => {
  try {
    const { data, error } = await supabase
      .from('post_entities')
      .insert({
        post_id: postId,
        entity_id: entityId
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error inserting post entity:', error);
    throw error;
  }
};
