import { supabase } from '@/integrations/supabase/client';

export interface RecommendedUser {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  displayName?: string;
  initials?: string;
  isFollowing?: boolean;
  reason?: string;
  source?: string;
  score?: number;
}

export const getUserRecommendations = async (currentUserId?: string, limit: number = 5): Promise<RecommendedUser[]> => {
  if (!currentUserId) return [];

  try {
    // Call the enhanced RPC function with new signature
    const { data: recommendations, error } = await supabase
      .rpc('get_who_to_follow', {
        p_user_id: currentUserId,
        p_limit: limit
      });

    if (error) throw error;

    // Transform the data and add display properties
    const enhancedRecommendations: RecommendedUser[] = (recommendations || [])
      .map(user => {
        const realName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        return {
          id: user.user_id,
          username: user.username,
          first_name: user.first_name ?? null,
          last_name: user.last_name ?? null,
          avatar_url: user.avatar_url,
          displayName: realName || user.username || 'Anonymous User',
          initials: getInitials(realName || user.username),
          isFollowing: false,
          reason: user.reason,
          source: user.source,
          score: user.score
        };
      });

    // Only return recommendations without logging impressions
    // Impressions will be logged only when user actually follows someone
    return enhancedRecommendations;
  } catch (error) {
    console.error('Error fetching user recommendations:', error);
    
    // Fallback: return simple user suggestions when RPC fails
    return getFallbackRecommendations(currentUserId, limit);
  }
};

// Fallback function for when RPC fails
const getFallbackRecommendations = async (currentUserId: string, limit: number): Promise<RecommendedUser[]> => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, created_at')
      .neq('id', currentUserId)
      .not('username', 'is', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (users || []).map(user => ({
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      displayName: user.username || 'Anonymous User',
      initials: getInitials(user.username),
      isFollowing: false,
      reason: 'Suggested for you',
      source: 'fallback',
      score: 0.5
    }));
  } catch (fallbackError) {
    console.error('Fallback recommendations failed:', fallbackError);
    return [];
  }
};

// Log impression for cooldown tracking (only called on follow action)
export const logUserImpression = async (viewerId: string, suggestedUserId: string) => {
  try {
    await supabase
      .from('suggestion_impressions')
      .insert({
        viewer_id: viewerId,
        suggested_id: suggestedUserId
      });
  } catch (error) {
    console.error('Error logging impression:', error);
    // Don't throw - this is non-critical
  }
};

const getInitials = (username: string | null): string => {
  if (!username) return 'AU';
  
  const parts = username.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
};