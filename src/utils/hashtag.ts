/**
 * Hashtag utility functions for parsing and processing hashtags
 */

// Enhanced regex pattern to match hashtags including multi-word ones
// Matches #word, #word123, #xuv 700 service, #react-native, etc.
const HASHTAG_PATTERN = /#([a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]|[a-zA-Z0-9])/g;

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
 * Normalize hashtag text (lowercase, spaces to dashes, collapse dashes)
 * @param hashtag - The hashtag text to normalize
 * @returns Normalized hashtag string
 */
export const normalizeHashtag = (hashtag: string): string => {
  return hashtag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // spaces to dashes  
    .replace(/-+/g, '-')         // collapse multiple dashes
    .replace(/[^a-z0-9\-]/g, '') // remove non-ASCII for now
    .replace(/^-+|-+$/g, '');    // trim leading/trailing dashes
};

/**
 * Validate if a string is a valid hashtag
 * @param hashtag - The hashtag to validate (without #)
 * @returns Boolean indicating if valid
 */
export const isValidHashtag = (hashtag: string): boolean => {
  // Allow letters, numbers, spaces, dashes, underscores
  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  return validPattern.test(hashtag) && hashtag.length >= 1 && hashtag.length <= 100;
};

/**
 * Parse hashtags for display rendering
 * @param text - The text to parse
 * @returns Array of parsed hashtag segments with original text and normalized names
 */
export interface HashtagSegment {
  type: 'text' | 'hashtag';
  content: string;
  normalized?: string;
  original?: string;
}

export const parseHashtagsForDisplay = (text: string): HashtagSegment[] => {
  if (!text) return [{ type: 'text', content: text }];
  
  const segments: HashtagSegment[] = [];
  let lastIndex = 0;
  let match;
  
  const regex = new RegExp(HASHTAG_PATTERN.source, HASHTAG_PATTERN.flags);
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before hashtag
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }
    
    const hashtagText = match[1];
    const original = match[0]; // includes the #
    const normalized = normalizeHashtag(hashtagText);
    
    // Only add valid hashtags
    if (isValidHashtag(hashtagText)) {
      segments.push({
        type: 'hashtag',
        content: original,
        normalized,
        original: hashtagText
      });
    } else {
      // Add invalid hashtag as regular text
      segments.push({
        type: 'text',
        content: original
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }
  
  return segments;
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