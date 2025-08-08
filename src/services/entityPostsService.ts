
import { supabase } from '@/integrations/supabase/client';
import { processPosts } from '@/hooks/feed/api/posts/processor';
import type { PostFeedItem } from '@/hooks/feed/api/posts/types';

const POST_SELECT = `
  id,
  title,
  content,
  post_type,
  visibility,
  user_id,
  created_at,
  updated_at,
  media,
  view_count,
  status,
  is_deleted,
  tags
`;

// Fetch posts that reference a given entity via post_entities or posts.entity_id
export async function fetchEntityPosts(
  entityId: string,
  currentUserId: string | null,
  page: number,
  itemsPerPage: number
): Promise<PostFeedItem[]> {
  try {
    // 1) Gather post IDs from post_entities for this entity
    const { data: taggedRows, error: taggedErr } = await supabase
      .from('post_entities')
      .select('post_id')
      .eq('entity_id', entityId);

    if (taggedErr) {
      console.error('Error fetching post_entities:', taggedErr);
    }

    const taggedIds = (taggedRows || []).map(r => r.post_id);

    // 2) Gather posts that directly reference the entity via posts.entity_id
    const { data: directPosts, error: directErr } = await supabase
      .from('posts')
      .select('id')
      .eq('entity_id', entityId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (directErr) {
      console.error('Error fetching direct entity posts:', directErr);
    }

    const directIds = (directPosts || []).map(p => p.id);

    // Unique combined post IDs
    const combinedIds = Array.from(new Set([...taggedIds, ...directIds]));
    if (combinedIds.length === 0) return [];

    // 3) Fetch posts by IDs with pagination; RLS will ensure only public/own posts are returned
    const from = page * itemsPerPage;
    const to = from + itemsPerPage - 1;

    const { data: postsData, error: postsErr } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', combinedIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsErr) throw postsErr;

    // 4) Process into PostFeedItem for consistent UI
    const userIdForProcessing = currentUserId || '';
    return await processPosts(postsData || [], userIdForProcessing);
  } catch (e) {
    console.error('fetchEntityPosts error:', e);
    return [];
  }
}
