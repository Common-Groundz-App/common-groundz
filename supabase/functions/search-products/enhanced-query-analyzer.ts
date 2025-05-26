
import { analyzeQueryIntent, QueryIntent } from "./query-analyzer.ts";

interface EnhancedQueryIntent extends QueryIntent {
  categoryHints: string[];
  languageDetected: string;
  confidenceFactors: {
    patternMatch: number;
    contextualClues: number;
    entityRecognition: number;
  };
  fallbackQueries: string[];
}

interface CategoryDomains {
  [key: string]: {
    highQuality: string[];
    moderate: string[];
    blocklist: string[];
  };
}

const CATEGORY_DOMAINS: CategoryDomains = {
  beauty: {
    highQuality: [
      'cosmopolitan.com', 'allure.com', 'byrdie.com', 'harpersbazaar.com',
      'elle.com', 'vogue.com', 'refinery29.com', 'healthline.com',
      'dermatologytimes.com', 'skincareedit.com', 'beautypedia.com',
      'paulaschoice.com', 'reddit.com', 'makeupalley.com'
    ],
    moderate: [
      'youtube.com', 'medium.com', 'quora.com', 'beautytips.in'
    ],
    blocklist: [
      'amazon.', 'flipkart.', 'myntra.', 'collection', 'category'
    ]
  },
  food: {
    highQuality: [
      'foodnetwork.com', 'bonappetit.com', 'seriouseats.com', 'epicurious.com',
      'allrecipes.com', 'food52.com', 'tastingtable.com', 'reddit.com'
    ],
    moderate: [
      'youtube.com', 'medium.com', 'quora.com', 'indianfood.in'
    ],
    blocklist: [
      'swiggy.', 'zomato.', 'delivery', 'order'
    ]
  },
  books: {
    highQuality: [
      'goodreads.com', 'bookish.com', 'npr.org', 'nytimes.com',
      'theguardian.com', 'reddit.com', 'kirkusreviews.com',
      'publishersweekly.com', 'booklist.ala.org', 'libraryjournal.com',
      'bookreviews.org', 'shelfawareness.com'
    ],
    moderate: [
      'youtube.com', 'medium.com', 'quora.com', 'booklist.in',
      'blog', 'wordpress.com', 'blogspot.com'
    ],
    blocklist: [
      'amazon.', 'flipkart.', 'buy', 'purchase', 'shop', 'cart'
    ]
  }
};

const MULTILINGUAL_PATTERNS = {
  hindi: {
    productWords: ['प्रोडक्ट', 'उत्पाद', 'सामान'],
    bestWords: ['सबसे अच्छा', 'बेहतरीन', 'श्रेष्ठ'],
    reviewWords: ['समीक्षा', 'रिव्यू', 'राय']
  },
  english: {
    productWords: ['product', 'item', 'thing'],
    bestWords: ['best', 'top', 'excellent', 'great'],
    reviewWords: ['review', 'opinion', 'feedback']
  }
};

export async function enhancedQueryAnalysis(
  query: string,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<EnhancedQueryIntent> {
  console.log(`🧠 Enhanced query analysis for: "${query}"`);
  
  // Language detection
  const language = detectLanguage(query);
  
  // Category hints extraction
  const categoryHints = extractCategoryHints(query);
  
  // Confidence factors analysis
  const confidenceFactors = analyzeConfidenceFactors(query);
  
  // Generate fallback queries
  const fallbackQueries = generateFallbackQueries(query, categoryHints);
  
  // Get base query intent
  const baseIntent = await analyzeQueryIntent(query, geminiApiKey, openaiApiKey);
  
  const enhancedIntent: EnhancedQueryIntent = {
    ...baseIntent,
    categoryHints,
    languageDetected: language,
    confidenceFactors,
    fallbackQueries,
    optimizedQuery: generateEnhancedOptimizedQuery(query, baseIntent.type, categoryHints, language)
  };
  
  console.log(`🎯 Enhanced analysis complete: ${enhancedIntent.type} (confidence: ${enhancedIntent.confidence})`);
  console.log(`📍 Category hints: ${categoryHints.join(', ')}`);
  console.log(`🌐 Language: ${language}`);
  
  return enhancedIntent;
}

function detectLanguage(query: string): string {
  const hindiPattern = /[\u0900-\u097F]/;
  return hindiPattern.test(query) ? 'hindi' : 'english';
}

function extractCategoryHints(query: string): string[] {
  const hints: string[] = [];
  const lowerQuery = query.toLowerCase();
  
  // Beauty/skincare keywords
  if (lowerQuery.match(/(cream|serum|cleanser|moisturizer|sunscreen|makeup|foundation|lipstick)/)) {
    hints.push('beauty');
  }
  
  // Food keywords
  if (lowerQuery.match(/(recipe|restaurant|food|dish|cuisine|taste|flavor)/)) {
    hints.push('food');
  }
  
  // Enhanced book keywords - be more aggressive about detecting books
  if (lowerQuery.match(/(book|novel|author|read|story|fiction|biography|habits|atomic habits|james clear|think and grow rich|napoleon hill|rich dad poor dad|robert kiyosaki|self.?help|personal development|bestseller|paperback|hardcover|kindle|audiobook|literature|memoir|non.?fiction)/)) {
    hints.push('books');
  }
  
  // Movie keywords
  if (lowerQuery.match(/(movie|film|actor|director|cinema|watch|review)/)) {
    hints.push('movies');
  }
  
  return hints;
}

function analyzeConfidenceFactors(query: string): { patternMatch: number; contextualClues: number; entityRecognition: number } {
  const lowerQuery = query.toLowerCase();
  
  // Pattern matching confidence
  const hasSpecificBrand = /\b(cerave|cetaphil|neutrogena|eclipse solaire|atomic habits|james clear|napoleon hill)\b/i.test(query);
  const hasProductType = /\b(serum|cream|cleanser|moisturizer|book|novel|habits)\b/i.test(query);
  const patternMatch = hasSpecificBrand ? 0.9 : hasProductType ? 0.7 : 0.5;
  
  // Contextual clues confidence
  const hasIntent = /\b(best|recommend|review|compare|summary|analysis)\b/i.test(query);
  const contextualClues = hasIntent ? 0.8 : 0.6;
  
  // Entity recognition confidence
  const hasQuotes = query.includes('"');
  const hasProperNouns = /\b[A-Z][a-z]+\b/.test(query);
  const entityRecognition = hasQuotes ? 0.9 : hasProperNouns ? 0.7 : 0.5;
  
  return { patternMatch, contextualClues, entityRecognition };
}

function generateFallbackQueries(query: string, categoryHints: string[]): string[] {
  const fallbacks: string[] = [];
  
  // Spell correction approximations
  fallbacks.push(query.replace(/s+/g, ' ').trim());
  
  // Add category context
  if (categoryHints.length > 0) {
    fallbacks.push(`${query} ${categoryHints[0]} recommendation`);
    fallbacks.push(`best ${query} ${categoryHints[0]}`);
    
    // Book-specific fallbacks
    if (categoryHints.includes('books')) {
      fallbacks.push(`"${query}" book review`);
      fallbacks.push(`${query} summary analysis`);
      fallbacks.push(`${query} author recommendations`);
      fallbacks.push(`${query} book summary`);
      fallbacks.push(`${query} james clear`); // For atomic habits specifically
    }
  }
  
  // Simplified version
  const simplified = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (simplified !== query) {
    fallbacks.push(simplified);
  }
  
  return fallbacks.filter((q, i, arr) => arr.indexOf(q) === i); // Remove duplicates
}

function generateEnhancedOptimizedQuery(
  originalQuery: string, 
  intentType: string, 
  categoryHints: string[], 
  language: string
): string {
  let optimized = originalQuery.trim();
  
  // Add category-specific enhancements
  if (categoryHints.includes('beauty')) {
    switch (intentType) {
      case 'specific_product':
        optimized = `"${optimized}" review dermatologist expert opinion -"buy online" -"shop now" -"add to cart"`;
        break;
      case 'category':
        optimized = `${optimized} dermatologist recommended expert review "best" -"buy online" -"collection"`;
        break;
      case 'comparison':
        optimized = `${optimized} comparison expert review dermatologist opinion -"buy online"`;
        break;
    }
  } else if (categoryHints.includes('books')) {
    switch (intentType) {
      case 'specific_product':
        optimized = `"${optimized}" book review summary analysis -"buy online" -"shop now" -"add to cart" -"price" -"purchase"`;
        break;
      case 'category':
        optimized = `${optimized} book review recommendation "best books" -"buy online" -"collection" -"shop"`;
        break;
      case 'comparison':
        optimized = `${optimized} book comparison review analysis -"buy online" -"price"`;
        break;
    }
  }
  
  // Add language-specific enhancements
  if (language === 'hindi') {
    optimized += ' भारत indian hindi review';
  }
  
  return optimized;
}

export function getEnhancedSourceQualityScore(
  domain: string,
  url: string,
  title: string,
  intentType: string,
  categoryHints: string[]
): number {
  let score = 0.5; // Base score
  
  // Category-specific domain scoring
  for (const category of categoryHints) {
    const categoryDomains = CATEGORY_DOMAINS[category];
    if (categoryDomains) {
      if (categoryDomains.highQuality.some(d => domain.includes(d))) {
        score += 0.4;
      } else if (categoryDomains.moderate.some(d => domain.includes(d))) {
        score += 0.2;
      } else if (categoryDomains.blocklist.some(d => domain.includes(d) || url.includes(d) || title.toLowerCase().includes(d))) {
        score -= 0.4;
      }
    }
  }
  
  // Special boost for book-related content
  if (categoryHints.includes('books')) {
    if (title.toLowerCase().includes('review') || title.toLowerCase().includes('summary') || 
        title.toLowerCase().includes('analysis') || title.toLowerCase().includes('book')) {
      score += 0.1;
    }
  }
  
  // Content freshness indicators
  const currentYear = new Date().getFullYear();
  if (title.includes(currentYear.toString()) || title.includes((currentYear - 1).toString())) {
    score += 0.1;
  }
  
  // Source diversity (prefer different domains)
  const isPopularDomain = ['youtube.com', 'medium.com', 'quora.com'].some(d => domain.includes(d));
  if (isPopularDomain) {
    score += 0.05; // Small boost, but prefer specialized sources
  }
  
  // Intent-specific adjustments
  if (intentType === 'specific_product') {
    // Heavily penalize listing/collection pages for specific products
    if (url.includes('/collections/') || url.includes('/category/') || 
        url.includes('/search') || title.toLowerCase().includes('products')) {
      score -= 0.6;
    }
  }
  
  return Math.max(0.1, Math.min(1.0, score));
}
