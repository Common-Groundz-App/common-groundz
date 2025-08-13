/**
 * Hashtag utility functions for parsing and processing hashtags
 */

// Regex pattern to match hashtags
// Matches #word, #word123, #word_test, but not #123 (must start with letter)
const HASHTAG_PATTERN = /#([a-zA-Z][a-zA-Z0-9_]*)/g;

/**
 * Extract hashtags from text content
 * @param text - The text to parse for hashtags
 * @returns Array of unique hashtag strings (without the # symbol)
 */
export const extractHashtags = (text: string): string[] => {
  if (!text) return [];
  
  const matches = text.match(HASHTAG_PATTERN);
  if (!matches) return [];
  
  // Remove # symbol and convert to lowercase, then remove duplicates
  const hashtags = matches
    .map(tag => tag.slice(1).toLowerCase())
    .filter((tag, index, array) => array.indexOf(tag) === index);
    
  return hashtags;
};

/**
 * Normalize hashtag text (lowercase, remove spaces/special chars)
 * @param hashtag - The hashtag text to normalize
 * @returns Normalized hashtag string
 */
export const normalizeHashtag = (hashtag: string): string => {
  return hashtag.toLowerCase().trim();
};

/**
 * Validate if a string is a valid hashtag
 * @param hashtag - The hashtag to validate (without #)
 * @returns Boolean indicating if valid
 */
export const isValidHashtag = (hashtag: string): boolean => {
  // Must start with letter, can contain letters, numbers, and underscores
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  return validPattern.test(hashtag) && hashtag.length >= 1 && hashtag.length <= 100;
};

/**
 * Extract hashtag text from combined title and content
 * @param title - Post title
 * @param content - Post content (HTML or plain text)
 * @returns Array of unique hashtags
 */
export const extractHashtagsFromPost = (title?: string, content?: string): string[] => {
  const titleHashtags = extractHashtags(title || '');
  const contentHashtags = extractHashtags(content || '');
  
  // Combine and deduplicate
  const allHashtags = [...titleHashtags, ...contentHashtags];
  return [...new Set(allHashtags)].filter(isValidHashtag);
};