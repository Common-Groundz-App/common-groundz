
import { supabase } from '@/integrations/supabase/client';

export interface NetworkRecommendation {
  id: string;
  name: string;
  rating: number;
  category: string;
  image: string;
  networkScore: number;
  followerCount: number;
}

export const getNetworkBasedRecommendations = async (
  currentEntityId: string,
  userFollowingIds: string[],
  limit: number = 3
): Promise<NetworkRecommendation[]> => {
  if (!userFollowingIds.length) {
    // Fallback to popular entities when user has no network
    return getPopularEntityRecommendations(currentEntityId, limit);
  }

  try {
    // Get entities recommended by users in the network
    const { data: networkEntities, error } = await supabase
      .from('recommendations')
      .select(`
        entity_id,
        rating,
        entities!inner(
          id,
          name,
          type,
          image_url,
          category_id
        )
      `)
      .in('user_id', userFollowingIds)
      .neq('entity_id', currentEntityId)
      .gte('rating', 4)
      .eq('visibility', 'public')
      .limit(limit * 3); // Get more to allow for deduplication

    if (error) throw error;

    // Process and deduplicate entities
    const entityMap = new Map<string, any>();
    
    networkEntities?.forEach(rec => {
      const entity = rec.entities;
      if (!entity) return;
      
      const existing = entityMap.get(entity.id);
      if (!existing || rec.rating > existing.rating) {
        entityMap.set(entity.id, {
          id: entity.id,
          name: entity.name,
          rating: rec.rating,
          category: entity.type || 'Unknown',
          image: entity.image_url || '',
          networkScore: rec.rating,
          followerCount: 1
        });
      } else {
        // Increment follower count for this entity
        existing.followerCount++;
        existing.networkScore = Math.max(existing.networkScore, rec.rating);
      }
    });

    // Convert to array and sort by network score
    const recommendations = Array.from(entityMap.values())
      .sort((a, b) => b.networkScore - a.networkScore)
      .slice(0, limit);

    console.log(`Found ${recommendations.length} network-based recommendations`);
    return recommendations;

  } catch (error) {
    console.error('Error fetching network recommendations:', error);
    return getPopularEntityRecommendations(currentEntityId, limit);
  }
};

const getPopularEntityRecommendations = async (
  currentEntityId: string,
  limit: number
): Promise<NetworkRecommendation[]> => {
  try {
    const { data: popularEntities, error } = await supabase
      .from('entities')
      .select('id, name, type, image_url, trending_score')
      .neq('id', currentEntityId)
      .eq('is_deleted', false)
      .order('trending_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return popularEntities?.map(entity => ({
      id: entity.id,
      name: entity.name,
      rating: 4.0, // Default rating for popular entities
      category: entity.type || 'Unknown',
      image: entity.image_url || '',
      networkScore: entity.trending_score || 0,
      followerCount: 0
    })) || [];

  } catch (error) {
    console.error('Error fetching popular recommendations:', error);
    return [];
  }
};
