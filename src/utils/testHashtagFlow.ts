import { extractHashtagsFromPost, normalizeHashtag } from '@/utils/hashtag';
import { processPostHashtags, getTrendingHashtags, searchHashtags } from '@/services/hashtagService';

/**
 * Test the complete hashtag flow
 */
export const testCompleteHashtagFlow = async (): Promise<void> => {
  console.log('🧪 Testing complete hashtag flow...');
  
  // Test 1: Hashtag extraction
  console.log('\n1. Testing hashtag extraction:');
  const testContent = '#xuv nice car';
  const extracted = extractHashtagsFromPost(undefined, testContent);
  console.log('Input:', testContent);
  console.log('Extracted:', extracted);
  console.log('Normalized:', extracted.map(normalizeHashtag));
  
  // Test 2: Hashtag processing (create a test)
  console.log('\n2. Testing hashtag processing:');
  if (extracted.length > 0) {
    const hashtags = extracted.map(tag => ({
      original: tag,
      normalized: normalizeHashtag(tag)
    }));
    console.log('Hashtags for processing:', hashtags);
    
    // This would normally be called with a real post ID
    console.log('(This would process hashtags for a real post)');
  }
  
  // Test 3: Search functionality
  console.log('\n3. Testing hashtag search:');
  try {
    const searchResults = await searchHashtags('xuv', 5);
    console.log('Search results for "xuv":', searchResults);
  } catch (error) {
    console.error('Search error:', error);
  }
  
  // Test 4: Trending hashtags
  console.log('\n4. Testing trending hashtags:');
  try {
    const trending = await getTrendingHashtags(5);
    console.log('Trending hashtags:', trending);
  } catch (error) {
    console.error('Trending error:', error);
  }
  
  console.log('\n✅ Hashtag flow test complete!');
};