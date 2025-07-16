
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
    .rpc('get_entity_followers_count', { input_entity_id: entityId });

  if (error) {
    console.error('Error getting entity followers count:', error);
    return 0;
  }

  return data || 0;
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

export interface EntityFollowerProfile {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface EntityFollowerWithContext extends EntityFollowerProfile {
  is_following: boolean;
  is_mutual: boolean;
  followed_at: string;
}

export interface EntityFollowersResponse {
  followers: EntityFollowerWithContext[];
  total_count: number;
}

export const getEntityFollowerNames = async (entityId: string, limit: number = 3): Promise<EntityFollowerProfile[]> => {
  const { data, error } = await supabase
    .rpc('get_entity_follower_names', { 
      input_entity_id: entityId, 
      follower_limit: limit 
    });

  if (error) {
    console.error('Error getting entity follower names:', error);
    return [];
  }

  return data || [];
};

export const getEntityFollowersWithContext = async (
  entityId: string,
  currentUserId: string | null,
  options: {
    search?: string;
    relationshipFilter?: 'all' | 'following' | 'mutual';
    limit?: number;
    offset?: number;
  } = {}
): Promise<EntityFollowerWithContext[]> => {
  const { search, relationshipFilter = 'all', limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .rpc('get_entity_followers_with_context', {
      input_entity_id: entityId,
      current_user_id: currentUserId,
      search_query: search || null,
      relationship_filter: relationshipFilter,
      follower_limit: limit,
      follower_offset: offset
    });

  if (error) {
    console.error('Error getting entity followers with context:', error);
    return [];
  }

  return data || [];
};
