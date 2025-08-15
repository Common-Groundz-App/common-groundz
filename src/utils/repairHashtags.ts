import { supabase } from '@/integrations/supabase/client';
import { extractHashtagsFromPost, normalizeHashtag } from '@/utils/hashtag';
import { processPostHashtags } from '@/services/hashtagService';

/**
 * Repair hashtags for existing posts that may be missing hashtag data
 * Uses the database function for more robust hashtag extraction and linking
 */
export const repairExistingPostHashtags = async (): Promise<void> => {
  try {
    console.log('🔧 Starting hashtag repair using database function...');
    
    // Use the new database repair function
    const { data: repairResults, error } = await supabase
      .rpc('repair_hashtag_relationships');
      
    if (error) {
      console.error('❌ Error running hashtag repair function:', error);
      return;
    }
    
    console.log('✅ Hashtag repair completed:', repairResults);
    
    if (repairResults && typeof repairResults === 'object') {
      const data = repairResults as any;
      console.log(`📊 Repair results:
        - Posts processed: ${data.posts_processed || 0}
        - Relationships created: ${data.relationships_created || 0}
        - New hashtags created: ${data.hashtags_created || 0}
      `);
    }
  } catch (error) {
    console.error('❌ Error in repairExistingPostHashtags:', error);
  }
};

/**
 * Alternative repair method using the original client-side logic
 * Use this as a fallback if the database function approach has issues
 */
export const repairExistingPostHashtagsLegacy = async (): Promise<void> => {
  try {
    console.log('🔧 Starting legacy hashtag repair...');
    
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
    
    console.log(`🎉 Legacy hashtag repair complete! Repaired ${repairedCount} posts`);
  } catch (error) {
    console.error('❌ Error in repairExistingPostHashtagsLegacy:', error);
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