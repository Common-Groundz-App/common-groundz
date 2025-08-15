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
    
    if (!repairResults || repairResults.length === 0) {
      console.log('✅ No hashtags needed repair - all relationships are correct!');
      return;
    }
    
    // Log repair results
    const grouped = repairResults.reduce((acc: any, result) => {
      if (!acc[result.action_taken]) {
        acc[result.action_taken] = [];
      }
      acc[result.action_taken].push(result);
      return acc;
    }, {});
    
    console.log('📊 Hashtag repair results:');
    Object.entries(grouped).forEach(([action, results]: [string, any]) => {
      console.log(`${action}: ${results.length} items`);
      if (action === 'relationship_created') {
        console.log('🔗 Created relationships for:', results.map((r: any) => `${r.post_id}:#${r.hashtag_content}`));
      }
    });
    
    const createdCount = (grouped.relationship_created || []).length;
    const hashtagsCreated = (grouped.hashtag_created || []).length;
    
    console.log(`🎉 Hashtag repair complete! Created ${hashtagsCreated} new hashtags and ${createdCount} new relationships`);
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