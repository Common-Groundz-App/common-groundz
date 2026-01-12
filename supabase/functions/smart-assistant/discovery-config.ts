/**
 * DISCOVERY CONFIGURATION - Hybrid Keyword + LLM Routing
 * 
 * This file defines the central configuration for platform discovery routing.
 * Tier 1: Fast keyword matching (0ms) using tokens and synonyms
 * Tier 2: LLM classification fallback (~300ms) when keywords don't match
 * 
 * @see https://docs.google.com/document/d/.../discovery-routing-architecture
 */

// ============= PLATFORM DISCOVERY MAP =============
// Maps categories to entity types, keyword tokens, and natural language synonyms

export const PLATFORM_DISCOVERY_MAP: Record<string, {
  entityTypes: string[];
  tokens: string[];
  synonyms: string[];
}> = {
  place: {
    entityTypes: ['place'],
    tokens: [
      'place', 'places', 'visit', 'destination', 'destinations',
      'park', 'parks', 'garden', 'gardens', 'museum', 'museums',
      'temple', 'temples', 'palace', 'palaces', 'monument', 'monuments',
      'attraction', 'attractions', 'landmark', 'landmarks',
      'trek', 'hike', 'hiking', 'trekking', 'trail', 'trails',
      'beach', 'beaches', 'waterfall', 'waterfalls',
      'zoo', 'sanctuary', 'wildlife', 'nature',
      'fort', 'forts', 'heritage', 'historical'
    ],
    synonyms: [
      'things to do', 'fun spots', 'sightseeing', 'explore',
      'hang out', 'hangout spots', 'chill spots', 'weekend getaway',
      'day trip', 'day out', 'outing', 'excursion',
      'must see', 'must visit', 'worth visiting'
    ]
  },
  
  food: {
    entityTypes: ['food'],
    tokens: [
      'restaurant', 'restaurants', 'cafe', 'cafes', 'coffee',
      'dessert', 'desserts', 'ice cream', 'bakery', 'bakeries',
      'dining', 'eatery', 'eateries', 'bistro', 'bistros',
      'food court', 'street food', 'fast food',
      'pizza', 'burger', 'biryani', 'dosa', 'idli', 'thali',
      'chinese', 'italian', 'indian', 'continental', 'asian',
      'breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'snacks',
      'vegetarian', 'vegan', 'non-veg', 'seafood',
      'bar', 'pub', 'brewery', 'rooftop'
    ],
    synonyms: [
      'good eats', 'where to eat', 'hungry', 'food spots',
      'grab a bite', 'dinner spots', 'lunch spots', 'breakfast spots',
      'something to eat', 'craving', 'foodie',
      'date night restaurant', 'family restaurant'
    ]
  },
  
  movie: {
    entityTypes: ['movie', 'tvshow'],
    tokens: [
      'movie', 'movies', 'film', 'films', 'cinema',
      'series', 'show', 'shows', 'tv show', 'tv series',
      'documentary', 'documentaries', 'anime', 'animation',
      'thriller', 'horror', 'comedy', 'drama', 'action',
      'sci-fi', 'science fiction', 'fantasy', 'romance',
      'bollywood', 'hollywood', 'netflix', 'prime', 'hotstar',
      'webseries', 'web series', 'miniseries'
    ],
    synonyms: [
      'watch something', 'something to watch', 'binge', 'binge watch',
      'streaming', 'movie night', 'film recommendation',
      'what to watch', 'worth watching', 'must watch'
    ]
  },
  
  book: {
    entityTypes: ['book'],
    tokens: [
      'book', 'books', 'novel', 'novels', 'read', 'reading',
      'fiction', 'non-fiction', 'nonfiction', 'biography', 'autobiography',
      'author', 'writer', 'literature', 'literary',
      'thriller', 'mystery', 'romance', 'fantasy', 'sci-fi',
      'self-help', 'self help', 'business', 'philosophy',
      'kindle', 'audiobook', 'ebook', 'paperback', 'hardcover'
    ],
    synonyms: [
      'something to read', 'good reads', 'reading suggestions',
      'page turner', 'book recommendation', 'worth reading',
      'must read', 'reading list', 'book club'
    ]
  },
  
  product: {
    entityTypes: ['product'],
    tokens: [
      // Tech
      'laptop', 'laptops', 'phone', 'phones', 'smartphone', 'tablet', 'tablets',
      'headphones', 'earbuds', 'earphones', 'speaker', 'speakers',
      'monitor', 'keyboard', 'mouse', 'charger', 'cable', 'adapter',
      'camera', 'lens', 'tripod', 'smartwatch', 'fitness tracker',
      // Home & Kitchen
      'bottle', 'bottles', 'container', 'containers', 'tupperware',
      'cookware', 'pan', 'pans', 'pot', 'pots', 'utensils', 'knife', 'knives',
      'mattress', 'pillow', 'pillows', 'bedding', 'blanket', 'blankets',
      'appliance', 'appliances', 'blender', 'mixer', 'air fryer',
      // Personal Care
      'sunscreen', 'lotion', 'cream', 'moisturizer', 'skincare',
      'shampoo', 'conditioner', 'haircare', 'serum', 'cleanser',
      'makeup', 'cosmetics', 'perfume', 'fragrance', 'deodorant',
      // Fashion & Accessories
      'shoes', 'sneakers', 'clothing', 'jacket', 'jackets', 'shirt', 'shirts',
      'watch', 'watches', 'bag', 'bags', 'backpack', 'backpacks',
      'luggage', 'suitcase', 'wallet', 'sunglasses',
      // Sports & Fitness
      'protein', 'supplement', 'supplements', 'vitamin', 'vitamins',
      'gym', 'workout', 'yoga', 'mat', 'dumbbells', 'weights',
      // Materials (often used in product queries)
      'steel', 'stainless', 'glass', 'ceramic', 'bamboo', 'wooden'
    ],
    synonyms: [
      'buy', 'purchase', 'shopping', 'get me',
      'looking for a', 'need a', 'want a',
      'product recommendation', 'worth buying'
    ]
  },
  
  person: {
    entityTypes: ['person'],
    tokens: [
      'person', 'people', 'professional', 'expert', 'specialist',
      'doctor', 'dentist', 'lawyer', 'accountant', 'consultant',
      'trainer', 'coach', 'instructor', 'teacher', 'tutor',
      'photographer', 'designer', 'developer', 'freelancer',
      'therapist', 'counselor', 'nutritionist', 'dietitian',
      'plumber', 'electrician', 'mechanic', 'contractor'
    ],
    synonyms: [
      'someone who', 'looking for someone', 'need someone',
      'professional help', 'expert advice', 'specialist near me'
    ]
  }
};

// ============= FLATTENED ARRAYS FOR FAST MATCHING =============

function flattenTokens(map: typeof PLATFORM_DISCOVERY_MAP): string[] {
  const tokens: string[] = [];
  for (const config of Object.values(map)) {
    tokens.push(...config.tokens);
  }
  return tokens;
}

function flattenSynonyms(map: typeof PLATFORM_DISCOVERY_MAP): string[] {
  const synonyms: string[] = [];
  for (const config of Object.values(map)) {
    synonyms.push(...config.synonyms);
  }
  return synonyms;
}

export const ALL_DISCOVERY_TOKENS = flattenTokens(PLATFORM_DISCOVERY_MAP);
export const ALL_SYNONYMS = flattenSynonyms(PLATFORM_DISCOVERY_MAP);

// ============= RECOMMENDATION VERBS =============
// Words that indicate the user is seeking recommendations

export const RECOMMENDATION_VERBS = [
  'recommend', 'recommends', 'recommendation', 'recommendations',
  'suggest', 'suggests', 'suggestion', 'suggestions',
  'best', 'top', 'good', 'great', 'nice', 'amazing', 'awesome',
  'popular', 'famous', 'trending', 'favorite', 'favourite',
  'which', 'what are', 'any good', 'know any'
];

// ============= VALID LLM CATEGORIES =============
// Categories that the LLM classification can return

export const VALID_LLM_CATEGORIES = [
  'book', 'movie', 'place', 'food', 'product', 'person'
];

// ============= NON-DISCOVERY PATTERNS =============
// Patterns that indicate a query is NOT about discovery (should stay in general)

export const NON_DISCOVERY_PATTERNS = [
  /\b(how|why|what is|what are|explain|tell me about|define|meaning of)\b.*\??\s*$/i,  // Explanatory questions
  /\b(fix|bug|error|issue|problem|debug|broken|not working)\b/i,                        // Technical issues
  /\b(code|programming|developer|api|function|variable|syntax)\b/i,                     // Dev questions
  /\b(learn|study|course|tutorial|lesson|class|exam|test)\b/i,                          // Educational
  /\b(weather|time|date|news|stock|crypto|score)\b/i,                                   // Realtime info
];

// ============= HELPER FUNCTIONS =============

/**
 * Check if a query matches any token from the discovery map
 */
export function findMatchedToken(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  // Check for multi-word tokens first (more specific)
  const multiWordTokens = ALL_DISCOVERY_TOKENS.filter(t => t.includes(' '));
  for (const token of multiWordTokens) {
    if (lowerQuery.includes(token)) {
      return token;
    }
  }
  
  // Then check single-word tokens with word boundary
  const singleWordTokens = ALL_DISCOVERY_TOKENS.filter(t => !t.includes(' '));
  for (const token of singleWordTokens) {
    // Use word boundary to avoid partial matches (e.g., "park" in "parking")
    const regex = new RegExp(`\\b${token}\\b`, 'i');
    if (regex.test(lowerQuery)) {
      return token;
    }
  }
  
  return null;
}

/**
 * Check if a query matches any synonym from the discovery map
 */
export function findMatchedSynonym(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  
  for (const synonym of ALL_SYNONYMS) {
    if (lowerQuery.includes(synonym)) {
      return synonym;
    }
  }
  
  return null;
}

/**
 * Check if a query contains any recommendation verb
 */
export function hasRecommendationVerb(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return RECOMMENDATION_VERBS.some(verb => lowerQuery.includes(verb));
}

/**
 * Check if a query matches non-discovery patterns (should stay in general)
 */
export function matchesNonDiscoveryPattern(query: string): boolean {
  return NON_DISCOVERY_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Determine the category from a matched token
 */
export function getCategoryFromToken(token: string): string | null {
  for (const [category, config] of Object.entries(PLATFORM_DISCOVERY_MAP)) {
    if (config.tokens.includes(token.toLowerCase())) {
      return category;
    }
  }
  return null;
}

/**
 * Determine the category from a matched synonym
 */
export function getCategoryFromSynonym(synonym: string): string | null {
  for (const [category, config] of Object.entries(PLATFORM_DISCOVERY_MAP)) {
    if (config.synonyms.includes(synonym.toLowerCase())) {
      return category;
    }
  }
  return null;
}

/**
 * Check if a query is likely a discovery query (for LLM fallback trigger)
 * This is more restrictive than just having a recommendation verb
 */
export function isLikelyDiscoveryQuery(query: string): boolean {
  // Must have a discovery/recommendation verb
  if (!hasRecommendationVerb(query)) {
    return false;
  }
  
  // Must NOT be an explanatory/technical question
  if (matchesNonDiscoveryPattern(query)) {
    return false;
  }
  
  // Should have location marker OR recommendation structure
  const hasLocationMarker = /\b(in|around|near|at|for)\s+[A-Z][a-z]+/i.test(query);
  const hasRecommendationStructure = /\b(recommend|suggest)\s+(a|some|me)\b/i.test(query.toLowerCase());
  const hasQuestionStructure = /\b(what|which|any)\s+.*(good|best|recommend)/i.test(query.toLowerCase());
  
  return hasLocationMarker || hasRecommendationStructure || hasQuestionStructure;
}

// ============= VALIDATION =============

/**
 * Validate the discovery map at module load time
 * Logs warnings if entity types don't match expected values
 */
function validateDiscoveryMap(): void {
  const expectedEntityTypes = [
    'movie', 'book', 'food', 'product', 'place', 'brand', 'event', 
    'service', 'professional', 'others', 'tvshow', 'course', 'app', 
    'game', 'experience', 'person'
  ];
  
  for (const [category, config] of Object.entries(PLATFORM_DISCOVERY_MAP)) {
    for (const entityType of config.entityTypes) {
      if (!expectedEntityTypes.includes(entityType)) {
        console.warn(`[discovery-config] ⚠️ Unknown entityType "${entityType}" in category "${category}"`);
      }
    }
    
    // Validate that tokens and synonyms are lowercase
    for (const token of config.tokens) {
      if (token !== token.toLowerCase()) {
        console.warn(`[discovery-config] ⚠️ Token "${token}" should be lowercase in category "${category}"`);
      }
    }
  }
  
  console.log(`[discovery-config] ✅ Loaded ${ALL_DISCOVERY_TOKENS.length} tokens and ${ALL_SYNONYMS.length} synonyms`);
}

// Run validation on module load
validateDiscoveryMap();
