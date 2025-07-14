
import { supabase } from '@/integrations/supabase/client';

export interface EntityFollow {
  id: string;
  user_id: string;
  entity_id: string;
  created_at: string;
}

export const followEntity = async (entityId: string): Promise<EntityFollow> => {
  const { data: follow, error } = await supabase
    .from('entity_follows')
    .insert({
      entity_id: entityId,
      user_id: (await supabase.auth.getUser()).data.user?.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error following entity:', error);
    throw error;
  }

  return follow;
};

export const unfollowEntity = async (entityId: string): Promise<void> => {
  const { error } = await supabase
    .from('entity_follows')
    .delete()
    .eq('entity_id', entityId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (error) {
    console.error('Error unfollowing entity:', error);
    throw error;
  }
};

export const isFollowingEntity = async (entityId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('entity_follows')
    .select('id')
    .eq('entity_id', entityId)
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking entity follow status:', error);
    return false;
  }

  return !!data;
};

export const getEntityFollowers = async (entityId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('entity_follows')
    .select('id')
    .eq('entity_id', entityId);

  if (error) {
    console.error('Error getting entity followers count:', error);
    return 0;
  }

  return data?.length || 0;
};

export const getUserFollowedEntities = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('entity_follows')
    .select('entity_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error getting user followed entities:', error);
    return [];
  }

  return data.map(follow => follow.entity_id);
};
