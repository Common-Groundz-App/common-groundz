
import { supabase } from '@/integrations/supabase/client';
import { parseHashtags, normalizeHashtag } from '@/utils/hashtagUtils';

// Re-export parseHashtags for use in components
export { parseHashtags } from '@/utils/hashtagUtils';

// Type-safe interface for hashtag query results
interface PostWithHashtag {
  posts: {
    id: string;
    title: string | null;
    content: string | null;
    post_type: string;
    visibility: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    media: any;
    view_count: number;
    comment_count: number;
    is_deleted: boolean;
  };
  hashtags: {
    name_norm: string;
  };
}

export async function processPostHashtags(postId: string, content: string) {
  const hashtags = parseHashtags(content);
  const uniqueHashtags = new Map();
  
  // Deduplicate by normalized name
  hashtags.forEach(tag => {
    if (!uniqueHashtags.has(tag.normalized)) {
      uniqueHashtags.set(tag.normalized, tag.original);
    }
  });
  
  // Get existing hashtags for this post for comparison
  const { data: existingHashtags } = await supabase
    .from('post_hashtags')
    .select('hashtag_id, hashtags!inner(name_norm)')
    .eq('post_id', postId);
  
  const existingNormalized = new Set(
    existingHashtags?.map((ph: any) => ph.hashtags.name_norm) || []
  );
  const newNormalized = new Set(uniqueHashtags.keys());
  
  // Calculate differences
  const toAdd = [...newNormalized].filter(tag => !existingNormalized.has(tag));
  const toRemove = [...existingNormalized].filter(tag => !newNormalized.has(tag));
  
  // Remove old hashtag relationships
  if (toRemove.length > 0) {
    const { data: hashtagsToRemove } = await supabase
      .from('hashtags')
      .select('id')
      .in('name_norm', toRemove);
    
    if (hashtagsToRemove?.length) {
      await supabase
        .from('post_hashtags')
        .delete()
        .eq('post_id', postId)
        .in('hashtag_id', hashtagsToRemove.map(h => h.id));
    }
  }
  
  // Add new hashtag relationships
  for (const normalized of toAdd) {
    const original = uniqueHashtags.get(normalized);
    try {
      // Upsert hashtag
      const { data: hashtag, error: hashtagError } = await supabase
        .from('hashtags')
        .upsert({
          name_original: original,
          name_norm: normalized
        }, {
          onConflict: 'name_norm'
        })
        .select('id')
        .single();
      
      if (hashtagError) {
        console.error('Error upserting hashtag:', hashtagError);
        continue;
      }
      
      // Create post-hashtag relationship
      const { error: relationError } = await supabase
        .from('post_hashtags')
        .upsert({
          post_id: postId,
          hashtag_id: hashtag.id
        });
      
      if (relationError) {
        console.error('Error creating post-hashtag relation:', relationError);
      }
    } catch (error) {
      console.error('Error processing hashtag:', error);
    }
  }
}

// Type-safe query with proper joins and runtime guards
export async function getPostsByHashtag(tagName: string, page = 0, limit = 20) {
  const { data, error } = await supabase
    .from('post_hashtags')
    .select(`
      posts:posts!inner (
        id, title, content, post_type, visibility, user_id, created_at, updated_at, media, view_count, comment_count, is_deleted
      ),
      hashtags!inner (name_norm)
    `)
    .eq('hashtags.name_norm', normalizeHashtag(tagName))
    .eq('posts.is_deleted', false)
    .order('created_at', { referencedTable: 'posts', ascending: false })
    .range(page * limit, (page + 1) * limit - 1);
  
  if (error) {
    console.error('Error fetching posts by hashtag:', error);
    return { posts: [], error };
  }
  
  // Type-safe mapping with runtime guard
  const posts = (data as PostWithHashtag[] || [])
    .map(item => item.posts)
    .filter(post => post != null); // Runtime guard for undefined posts
  
  return { posts, error: null };
}

export async function getTrendingHashtags(limit = 10) {
  const { data, error } = await supabase
    .from('hashtags')
    .select(`
      name_original,
      name_norm,
      post_count:post_hashtags(count)
    `)
    .order('post_count', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Error fetching trending hashtags:', error);
    return { hashtags: [], error };
  }
  
  return { hashtags: data || [], error: null };
}
