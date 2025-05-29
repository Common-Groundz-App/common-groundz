
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

export interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

export const fetchUserPosts = async (profileUserId: string, isOwnProfile: boolean) => {
  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(username, avatar_url)
      `)
      .eq('user_id', profileUserId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // If not own profile, only show public posts
    if (!isOwnProfile) {
      query = query.eq('visibility', 'public');
    }

    const { data: postsData, error } = await query;

    if (error) throw error;
    
    // Fetch entities for all posts using direct query instead of RPC function
    const postIds = (postsData || []).map(post => post.id);
    
    if (postIds.length > 0) {
      const entitiesByPostId: Record<string, Entity[]> = {};
      
      // Direct query to get post entities instead of using RPC
      const { data: entityData, error: entityError } = await supabase
        .from('post_entities')
        .select('post_id, entity_id, entities:entity_id(*)')
        .in('post_id', postIds);
        
      if (entityError) {
        console.error('Error fetching post entities:', entityError);
      } else if (entityData) {
        // Process the relationships
        entityData.forEach((item: any) => {
          if (!entitiesByPostId[item.post_id]) {
            entitiesByPostId[item.post_id] = [];
          }
          if (item.entities) {
            entitiesByPostId[item.post_id].push(item.entities);
          }
        });
      }
      
      // Add entities and flatten profile data to posts
      const enrichedPosts = (postsData || []).map(post => {
        // Process media properly with type safety
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
            url: item.url || '',
            type: item.type || 'image',
            caption: item.caption,
            alt: item.alt,
            order: item.order || 0,
            thumbnail_url: item.thumbnail_url,
            is_deleted: item.is_deleted,
            session_id: item.session_id,
            id: item.id
          }));
        }

        // Flatten the profiles data
        const profile = (post as any).profiles;

        return {
          ...post,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems,
          profiles: undefined // Remove the nested profiles object
        };
      });
      
      return enrichedPosts as Post[];
    } else {
      return (postsData || []).map(post => {
        // Process media properly for posts without entities
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
            url: item.url || '',
            type: item.type || 'image',
            caption: item.caption,
            alt: item.alt,
            order: item.order || 0,
            thumbnail_url: item.thumbnail_url,
            is_deleted: item.is_deleted,
            session_id: item.session_id,
            id: item.id
          }));
        }

        // Flatten the profiles data
        const profile = (post as any).profiles;

        return {
          ...post,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          media: mediaItems,
          profiles: undefined // Remove the nested profiles object
        };
      }) as Post[];
    }
  } catch (error) {
    console.error('Error in fetchUserPosts:', error);
    throw error;
  }
};
