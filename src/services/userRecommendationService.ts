import { supabase } from '@/integrations/supabase/client';

export interface RecommendedUser {
  id: string;
  username: string | null;
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
      .map(user => ({
        id: user.user_id, // Updated field name
        username: user.username,
        avatar_url: user.avatar_url,
        displayName: user.username || 'Anonymous User',
        initials: getInitials(user.username),
        isFollowing: false,
        reason: user.reason,
        source: user.source,
        score: user.score
      }));

    // Log impressions for cooldown tracking
    if (enhancedRecommendations.length > 0) {
      await logUserImpressions(currentUserId, enhancedRecommendations.map(u => u.id));
    }

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

// Log impressions for cooldown tracking
const logUserImpressions = async (viewerId: string, suggestedUserIds: string[]) => {
  try {
    const impressions = suggestedUserIds.map(suggestedId => ({
      viewer_id: viewerId,
      suggested_id: suggestedId
    }));

    await supabase
      .from('suggestion_impressions')
      .insert(impressions);
  } catch (error) {
    console.error('Error logging impressions:', error);
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