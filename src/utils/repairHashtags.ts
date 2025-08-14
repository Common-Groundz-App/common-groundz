import { supabase } from '@/integrations/supabase/client';
import { extractHashtagsFromPost, normalizeHashtag } from '@/utils/hashtag';
import { processPostHashtags } from '@/services/hashtagService';

/**
 * Repair hashtags for existing posts that may be missing hashtag data
 */
export const repairExistingPostHashtags = async (): Promise<void> => {
  try {
    console.log('🔧 Starting hashtag repair for existing posts...');
    
    // Get all posts that might have hashtags
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, title, content')
      .eq('is_deleted', false);
      
    if (error) {
      console.error('❌ Error fetching posts:', error);
      return;
    }
    
    if (!posts || posts.length === 0) {
      console.log('No posts found to repair');
      return;
    }
    
    console.log(`Found ${posts.length} posts to check for hashtags`);
    
    let repairedCount = 0;
    
    for (const post of posts) {
      // Extract hashtags from post content
      const hashtagStrings = extractHashtagsFromPost(post.title, post.content);
      
      if (hashtagStrings.length > 0) {
        console.log(`📝 Processing hashtags for post ${post.id}:`, hashtagStrings);
        
        const hashtags = hashtagStrings.map(tag => ({
          original: tag,
          normalized: normalizeHashtag(tag)
        }));
        
        // Process hashtags for this post
        const success = await processPostHashtags(post.id, hashtags);
        if (success) {
          repairedCount++;
          console.log(`✅ Repaired hashtags for post ${post.id}`);
        } else {
          console.error(`❌ Failed to repair hashtags for post ${post.id}`);
        }
      }
    }
    
    console.log(`🎉 Hashtag repair complete! Repaired ${repairedCount} posts`);
  } catch (error) {
    console.error('❌ Error in repairExistingPostHashtags:', error);
  }
};

// Test hashtag extraction with the specific example
export const testHashtagExtraction = (): void => {
  const testContent = "#xuv nice car";
  const extracted = extractHashtagsFromPost(undefined, testContent);
  console.log('🧪 Test hashtag extraction:');
  console.log('Input:', testContent);
  console.log('Extracted:', extracted);
  console.log('Normalized:', extracted.map(normalizeHashtag));
};