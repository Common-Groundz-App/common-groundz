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

// Common product patterns and brand recognition
const BRAND_PATTERNS = [
  'CeraVe', 'Neutrogena', 'The Ordinary', 'Skinceuticals', 'Olay', 'L\'Oreal', 'Minimalist',
  'Cetaphil', 'Vanicream', 'La Roche-Posay', 'Eucerin', 'Aveeno', 'Dove', 'Garnier',
  'Maybelline', 'MAC', 'Urban Decay', 'Fenty Beauty', 'NARS', 'Too Faced', 'Tarte',
  'Clinique', 'Estee Lauder', 'Lancome', 'Shiseido', 'Drunk Elephant', 'Paula\'s Choice',
  'Mad Hippie', 'Timeless', 'Hyram', 'Glossier', 'Fenty', 'Rare Beauty', 'Kylie Cosmetics'
];

const PRODUCT_TYPE_PATTERNS = [
  'serum', 'moisturizer', 'cleanser', 'cream', 'lotion', 'oil', 'toner', 'essence',
  'foundation', 'concealer', 'mascara', 'lipstick', 'eyeshadow', 'blush', 'bronzer',
  'primer', 'setting spray', 'powder', 'highlighter', 'contour', 'eyeliner', 'lip gloss',
  'sunscreen', 'face wash', 'exfoliant', 'mask', 'treatment', 'spot treatment'
];

// Extract product mentions from HTML content
export async function extractProductMentions(
  sources: Array<{ url: string; title: string; snippet: string; type: string }>
): Promise<ProductMention[]> {
  const mentions: ProductMention[] = [];
  
  for (const source of sources) {
    try {
      console.log(`🔍 Extracting products from: ${source.title}`);
      
      // First, try to fetch full HTML content
      let fullContent = source.snippet;
      try {
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ProductBot/1.0)',
          },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        if (response.ok) {
          const html = await response.text();
          fullContent = extractTextFromHTML(html);
          console.log(`✅ Fetched full content from ${source.url} (${fullContent.length} chars)`);
        }
      } catch (fetchError) {
        console.log(`⚠️ Could not fetch ${source.url}, using snippet only:`, fetchError);
      }
      
      // Extract product mentions from content
      const productMentions = findProductMentions(fullContent, source);
      mentions.push(...productMentions);
      
    } catch (error) {
      console.error(`❌ Error processing source ${source.url}:`, error);
    }
  }
  
  console.log(`🎯 Total product mentions extracted: ${mentions.length}`);
  return mentions;
}

// Extract clean text from HTML
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove HTML tags but keep text content
  cleanHtml = cleanHtml.replace(/<[^>]*>/g, ' ');
  
  // Clean up whitespace
  cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
  
  // Limit to reasonable length (first 10k characters)
  return cleanHtml.substring(0, 10000);
}

// Find product mentions in text content
function findProductMentions(
  content: string, 
  source: { url: string; title: string; type: string }
): ProductMention[] {
  const mentions: ProductMention[] = [];
  const lowerContent = content.toLowerCase();
  
  // Strategy 1: Brand + Product Type combinations
  for (const brand of BRAND_PATTERNS) {
    for (const productType of PRODUCT_TYPE_PATTERNS) {
      const patterns = [
        new RegExp(`\\b${brand}\\s+[\\w\\s]*${productType}[\\w\\s]*`, 'gi'),
        new RegExp(`\\b${brand}\\s+[\\w\\s]{0,30}${productType}`, 'gi'),
        new RegExp(`${productType}[\\w\\s]{0,10}by\\s+${brand}`, 'gi'),
        new RegExp(`${productType}[\\w\\s]{0,10}from\\s+${brand}`, 'gi')
      ];
      
      for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            const cleanMatch = match.trim();
            if (cleanMatch.length > 5 && cleanMatch.length < 100) {
              mentions.push({
                name: cleanMatch,
                brand: brand,
                context: extractContext(content, match, 100),
                source_url: source.url,
                source_title: source.title,
                source_type: source.type as any,
                confidence_score: calculateConfidenceScore(match, content, source)
              });
            }
          }
        }
      }
    }
  }
  
  // Strategy 2: Quoted product names (often in reviews)
  const quotedProducts = content.match(/"([^"]{10,80})"/g);
  if (quotedProducts) {
    for (const quoted of quotedProducts) {
      const productName = quoted.replace(/"/g, '');
      if (containsProductIndicators(productName)) {
        mentions.push({
          name: productName,
          brand: extractBrandFromName(productName),
          context: extractContext(content, quoted, 100),
          source_url: source.url,
          source_title: source.title,
          source_type: source.type as any,
          confidence_score: calculateConfidenceScore(quoted, content, source) * 1.2 // Boost quoted items
        });
      }
    }
  }
  
  // Strategy 3: Title case product names
  const titleCasePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Serum|Moisturizer|Cleanser|Cream|Foundation|Mascara|Lipstick)\b/g;
  const titleCaseMatches = content.match(titleCasePattern);
  if (titleCaseMatches) {
    for (const match of titleCaseMatches) {
      mentions.push({
        name: match,
        brand: extractBrandFromName(match),
        context: extractContext(content, match, 100),
        source_url: source.url,
        source_title: source.title,
        source_type: source.type as any,
        confidence_score: calculateConfidenceScore(match, content, source)
      });
    }
  }
  
  return mentions;
}

// Extract surrounding context for a match
function extractContext(content: string, match: string, contextLength: number): string {
  const index = content.indexOf(match);
  if (index === -1) return match;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + match.length + contextLength);
  
  return content.substring(start, end).trim();
}

// Check if a string contains product indicators
function containsProductIndicators(text: string): boolean {
  const lowerText = text.toLowerCase();
  return PRODUCT_TYPE_PATTERNS.some(type => lowerText.includes(type)) ||
         BRAND_PATTERNS.some(brand => lowerText.toLowerCase().includes(brand.toLowerCase()));
}

// Extract brand from product name
function extractBrandFromName(productName: string): string {
  for (const brand of BRAND_PATTERNS) {
    if (productName.toLowerCase().includes(brand.toLowerCase())) {
      return brand;
    }
  }
  return '';
}

// Calculate confidence score for a product mention
function calculateConfidenceScore(
  match: string, 
  content: string, 
  source: { title: string; type: string }
): number {
  let score = 0.5; // Base score
  
  // Boost if in title
  if (source.title.toLowerCase().includes(match.toLowerCase())) {
    score += 0.3;
  }
  
  // Boost for review sites
  if (source.type === 'review') {
    score += 0.2;
  }
  
  // Boost if mentioned multiple times
  const mentionCount = (content.toLowerCase().match(new RegExp(match.toLowerCase(), 'g')) || []).length;
  score += Math.min(mentionCount * 0.1, 0.3);
  
  // Boost for specific product words
  const specificWords = ['best', 'recommend', 'favorite', 'love', 'amazing', 'perfect'];
  const context = extractContext(content, match, 50).toLowerCase();
  for (const word of specificWords) {
    if (context.includes(word)) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1.0);
}

// Analyze frequency and rank products
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
  
  // Convert to array and sort by weighted score
  const rankedProducts = Array.from(productMap.values())
    .map(product => ({
      ...product,
      quality_score: product.quality_score / product.mention_count // Average quality
    }))
    .sort((a, b) => {
      const scoreA = a.mention_count * a.quality_score;
      const scoreB = b.mention_count * b.quality_score;
      return scoreB - scoreA;
    });
  
  console.log(`📊 Product frequency analysis complete:`, 
    rankedProducts.slice(0, 5).map(p => `${p.product_name} (${p.mention_count} mentions, score: ${p.quality_score.toFixed(2)})`));
  
  return rankedProducts.slice(0, 5); // Return top 5 products
}

// Normalize product names for comparison
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
