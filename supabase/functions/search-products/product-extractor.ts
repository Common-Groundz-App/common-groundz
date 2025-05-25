
interface ProductMention {
  name: string;
  brand?: string;
  context: string;
  source_url: string;
  source_title: string;
  source_type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce';
  confidence_score: number;
}

interface RankedProduct {
  product_name: string;
  brand: string;
  normalized_name: string;
  mention_count: number;
  quality_score: number;
  contexts: Array<{
    text: string;
    source_url: string;
    source_title: string;
    source_type: string;
  }>;
}

export interface ProductExtractionResult {
  products: RankedProduct[];
  total_sources_processed: number;
  extraction_method: string;
}

// Enhanced brand patterns with more comprehensive coverage
const BRAND_PATTERNS = [
  // Skincare Brands
  'CeraVe', 'Cetaphil', 'Neutrogena', 'The Ordinary', 'Skinceuticals', 'Olay', 'L\'Oreal',
  'Minimalist', 'Vanicream', 'La Roche-Posay', 'Eucerin', 'Aveeno', 'Dove', 'Garnier',
  'Paula\'s Choice', 'Mad Hippie', 'Timeless', 'Drunk Elephant', 'Glossier', 
  'Hyram', 'First Aid Beauty', 'Youth to the People', 'Tatcha', 'Sunday Riley',
  'Kiehl\'s', 'Clinique', 'Estee Lauder', 'Lancome', 'Shiseido', 'Dermalogica',
  'Pixi', 'Bioderma', 'Vichy', 'Avene', 'COSRX', 'Some By Mi', 'Innisfree',
  
  // Indian Brands
  'Himalaya', 'Lakme', 'Lotus', 'Biotique', 'Forest Essentials', 'Kama Ayurveda',
  'Plum', 'MCaffeine', 'Mamaearth', 'The Body Shop', 'Nykaa', 'Sugar Cosmetics',
  'Colorbar', 'Faces Canada', 'Blue Heaven', 'Revlon', 'WOW Skin Science',
  
  // Makeup Brands
  'Maybelline', 'MAC', 'Urban Decay', 'Fenty Beauty', 'NARS', 'Too Faced', 'Tarte',
  'Rare Beauty', 'Kylie Cosmetics', 'Charlotte Tilotte', 'Huda Beauty'
];

// Enhanced product type patterns with more specific terms
const PRODUCT_TYPE_PATTERNS = [
  // Skincare
  'cleanser', 'face wash', 'facial cleanser', 'foaming cleanser', 'gel cleanser', 'cream cleanser',
  'moisturizer', 'moisturiser', 'face cream', 'day cream', 'night cream', 'face lotion',
  'serum', 'face serum', 'vitamin c serum', 'niacinamide serum', 'hyaluronic acid serum',
  'toner', 'astringent', 'essence', 'face mist', 'micellar water',
  'sunscreen', 'sunblock', 'spf', 'facial sunscreen',
  'exfoliant', 'scrub', 'face scrub', 'chemical exfoliant', 'aha', 'bha',
  'face mask', 'sheet mask', 'clay mask', 'overnight mask',
  'face oil', 'facial oil', 'treatment oil',
  'spot treatment', 'acne treatment', 'blemish treatment',
  
  // Makeup
  'foundation', 'concealer', 'primer', 'bb cream', 'cc cream', 'tinted moisturizer',
  'powder', 'setting powder', 'compact powder', 'loose powder',
  'blush', 'bronzer', 'highlighter', 'contour', 'contouring',
  'eyeshadow', 'eye shadow', 'eyeshadow palette', 'eyeliner', 'mascara',
  'lipstick', 'lip gloss', 'lip balm', 'lip tint', 'liquid lipstick',
  'setting spray', 'makeup spray', 'fixing spray'
];

// Enhanced product extraction with stricter brand requirements
export async function extractProductMentions(
  sources: Array<{ url: string; title: string; snippet: string; type: string; qualityScore?: number }>
): Promise<ProductMention[]> {
  const mentions: ProductMention[] = [];
  
  for (const source of sources) {
    try {
      console.log(`🔍 Extracting products from: ${source.title} (Quality: ${source.qualityScore?.toFixed(2) || 'N/A'})`);
      
      // Prioritize high-quality sources
      if (source.qualityScore && source.qualityScore < 0.4) {
        console.log(`⚠️ Skipping low-quality source: ${source.title}`);
        continue;
      }
      
      let fullContent = source.snippet;
      try {
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ProductBot/1.0)',
          },
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.ok) {
          const html = await response.text();
          fullContent = extractTextFromHTML(html);
          console.log(`✅ Fetched full content from ${source.url} (${fullContent.length} chars)`);
        }
      } catch (fetchError) {
        console.log(`⚠️ Using snippet for ${source.url}:`, fetchError);
      }
      
      // Enhanced product extraction with stricter criteria
      const productMentions = findEnhancedProductMentions(fullContent, source);
      mentions.push(...productMentions);
      
    } catch (error) {
      console.error(`❌ Error processing source ${source.url}:`, error);
    }
  }
  
  console.log(`🎯 Total enhanced product mentions extracted: ${mentions.length}`);
  return mentions;
}

function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep text content
  cleanHtml = cleanHtml.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
  
  // Limit to reasonable length
  return cleanHtml.substring(0, 8000);
}

// Enhanced product mention finding with stricter brand requirements
function findEnhancedProductMentions(
  content: string, 
  source: { url: string; title: string; type: string; qualityScore?: number }
): ProductMention[] {
  const mentions: ProductMention[] = [];
  const lowerContent = content.toLowerCase();
  
  // Strategy 1: Strict Brand + Complete Product Name combinations
  for (const brand of BRAND_PATTERNS) {
    const brandLower = brand.toLowerCase();
    
    // Look for complete product names with brand
    const completeProductPattern = new RegExp(
      `\\b${escapeRegex(brand)}\\s+([A-Za-z0-9\\s]{5,50}?)\\b(?=\\s|\\.|,|!|\\?|$)`,
      'gi'
    );
    
    const matches = content.match(completeProductPattern);
    if (matches) {
      for (const match of matches) {
        const cleanMatch = match.trim();
        
        // Enhanced validation: must contain product type and brand
        if (cleanMatch.length > 10 && cleanMatch.length < 80 && 
            containsProductType(cleanMatch) &&
            !isGenericDescription(cleanMatch)) {
          
          const confidence = calculateEnhancedConfidenceScore(cleanMatch, content, source);
          
          if (confidence > 0.6) { // Higher threshold for quality
            mentions.push({
              name: cleanMatch,
              brand: brand,
              context: extractContext(content, match, 150),
              source_url: source.url,
              source_title: source.title,
              source_type: source.type as any,
              confidence_score: confidence
            });
          }
        }
      }
    }
  }
  
  // Strategy 2: Quoted specific product names (often exact product names)
  const quotedProducts = content.match(/"([^"]{15,80})"/g);
  if (quotedProducts) {
    for (const quoted of quotedProducts) {
      const productName = quoted.replace(/"/g, '');
      const brand = extractBrandFromName(productName);
      
      if (brand && containsProductType(productName) && !isGenericDescription(productName)) {
        const confidence = calculateEnhancedConfidenceScore(quoted, content, source) * 1.3; // Boost quoted items
        
        if (confidence > 0.7) {
          mentions.push({
            name: productName,
            brand: brand,
            context: extractContext(content, quoted, 150),
            source_url: source.url,
            source_title: source.title,
            source_type: source.type as any,
            confidence_score: confidence
          });
        }
      }
    }
  }
  
  // Strategy 3: Structured product mentions (lists, recommendations)
  const structuredPattern = /(?:best|top|recommended|favorite)\s+([A-Z][a-zA-Z\s]+(?:serum|moisturizer|cleanser|cream|foundation|mascara))/gi;
  const structuredMatches = content.match(structuredPattern);
  if (structuredMatches) {
    for (const match of structuredMatches) {
      const productPart = match.replace(/^(?:best|top|recommended|favorite)\s+/i, '');
      const brand = extractBrandFromName(productPart);
      
      if (brand && productPart.length > 10) {
        const confidence = calculateEnhancedConfidenceScore(match, content, source) * 1.1;
        
        if (confidence > 0.6) {
          mentions.push({
            name: productPart,
            brand: brand,
            context: extractContext(content, match, 150),
            source_url: source.url,
            source_title: source.title,
            source_type: source.type as any,
            confidence_score: confidence
          });
        }
      }
    }
  }
  
  return mentions;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsProductType(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PRODUCT_TYPE_PATTERNS.some(type => lowerText.includes(type.toLowerCase()));
}

function isGenericDescription(text: string): boolean {
  const genericTerms = [
    'best moisturizer', 'good cleanser', 'great serum', 'perfect cream',
    'buy online', 'shop now', 'add to cart', 'price range', 'available at',
    'collection', 'category', 'browse', 'filter', 'sort by'
  ];
  
  const lowerText = text.toLowerCase();
  return genericTerms.some(term => lowerText.includes(term));
}

function extractContext(content: string, match: string, contextLength: number): string {
  const index = content.indexOf(match);
  if (index === -1) return match;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + match.length + contextLength);
  
  return content.substring(start, end).trim();
}

function extractBrandFromName(productName: string): string {
  for (const brand of BRAND_PATTERNS) {
    if (productName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return '';
}

function calculateEnhancedConfidenceScore(
  match: string, 
  content: string, 
  source: { title: string; type: string; qualityScore?: number }
): number {
  let score = 0.4; // Lower base score, require evidence
  
  // Boost for source quality
  if (source.qualityScore) {
    score += source.qualityScore * 0.3;
  }
  
  // Boost if mentioned in title
  if (source.title.toLowerCase().includes(match.toLowerCase())) {
    score += 0.25;
  }
  
  // Boost for review sites and expert content
  if (source.type === 'review') {
    score += 0.2;
  }
  
  // Check context quality
  const context = extractContext(content, match, 100).toLowerCase();
  
  // Boost for recommendation context
  const recommendationWords = ['recommend', 'best', 'favorite', 'love', 'holy grail', 'must-have', 'amazing'];
  const recommendationBoost = recommendationWords.filter(word => context.includes(word)).length * 0.1;
  score += Math.min(recommendationBoost, 0.3);
  
  // Boost for dermatologist/expert mentions
  if (context.includes('dermatologist') || context.includes('expert') || context.includes('professional')) {
    score += 0.15;
  }
  
  // Penalize for commercial language
  const commercialTerms = ['buy', 'shop', 'cart', 'discount', 'sale', 'offer'];
  const commercialPenalty = commercialTerms.filter(term => context.includes(term)).length * 0.05;
  score -= commercialPenalty;
  
  // Boost for specific ingredient mentions
  const ingredients = ['niacinamide', 'hyaluronic acid', 'vitamin c', 'retinol', 'salicylic acid', 'aha', 'bha'];
  if (ingredients.some(ingredient => match.toLowerCase().includes(ingredient))) {
    score += 0.1;
  }
  
  return Math.max(0.1, Math.min(score, 1.0));
}

export function analyzeProductFrequency(mentions: ProductMention[]): RankedProduct[] {
  const productMap = new Map<string, RankedProduct>();
  
  for (const mention of mentions) {
    const normalizedName = normalizeProductName(mention.name);
    
    if (!productMap.has(normalizedName)) {
      productMap.set(normalizedName, {
        product_name: mention.name,
        brand: mention.brand || extractBrandFromName(mention.name),
        normalized_name: normalizedName,
        mention_count: 0,
        quality_score: 0,
        contexts: []
      });
    }
    
    const product = productMap.get(normalizedName)!;
    product.mention_count++;
    product.quality_score += mention.confidence_score;
    product.contexts.push({
      text: mention.context,
      source_url: mention.source_url,
      source_title: mention.source_title,
      source_type: mention.source_type
    });
    
    // Use the highest quality version of the product name
    if (mention.confidence_score > 0.8 && mention.name.length > product.product_name.length) {
      product.product_name = mention.name;
    }
  }
  
  // Convert to array and sort by enhanced scoring
  const rankedProducts = Array.from(productMap.values())
    .filter(product => product.mention_count >= 2 || product.quality_score > 0.8) // Filter low-quality products
    .map(product => ({
      ...product,
      quality_score: product.quality_score / product.mention_count // Average quality
    }))
    .sort((a, b) => {
      // Enhanced scoring: frequency * quality * brand recognition
      const scoreA = a.mention_count * a.quality_score * (a.brand ? 1.2 : 1.0);
      const scoreB = b.mention_count * b.quality_score * (b.brand ? 1.2 : 1.0);
      return scoreB - scoreA;
    });
  
  console.log(`📊 Enhanced product frequency analysis complete:`, 
    rankedProducts.slice(0, 5).map(p => `${p.product_name} (${p.mention_count} mentions, score: ${p.quality_score.toFixed(2)})`));
  
  return rankedProducts.slice(0, 5); // Return top 5 products
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
