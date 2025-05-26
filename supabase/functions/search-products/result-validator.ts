
interface ValidationResult {
  relevanceScore: number;
  diversityScore: number;
  freshnessScore: number;
  credibilityScore: number;
  overallQuality: number;
  suggestions: string[];
  explanation: string;
}

interface ProductResult {
  product_name: string;
  brand: string;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    type: string;
  }>;
  mention_frequency: number;
  quality_score: number;
}

export async function validateSearchResults(
  query: string,
  results: ProductResult[],
  queryIntent: any,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<ValidationResult> {
  console.log(`🔍 Validating ${results.length} results for query: "${query}"`);
  
  // Calculate individual scores
  const relevanceScore = calculateRelevanceScore(query, results, queryIntent);
  const diversityScore = calculateDiversityScore(results);
  const freshnessScore = calculateFreshnessScore(results);
  const credibilityScore = calculateCredibilityScore(results);
  
  // Overall quality score (weighted average)
  const overallQuality = (
    relevanceScore * 0.4 +
    diversityScore * 0.2 +
    freshnessScore * 0.2 +
    credibilityScore * 0.2
  );
  
  // Generate suggestions for improvement
  const suggestions = generateImprovementSuggestions(
    relevanceScore, 
    diversityScore, 
    freshnessScore, 
    credibilityScore,
    results.length
  );
  
  // Generate explanation
  const explanation = await generateResultExplanation(
    query, 
    results, 
    queryIntent, 
    overallQuality,
    geminiApiKey,
    openaiApiKey
  );
  
  const validation: ValidationResult = {
    relevanceScore,
    diversityScore,
    freshnessScore,
    credibilityScore,
    overallQuality,
    suggestions,
    explanation
  };
  
  console.log(`✅ Validation complete: Overall quality ${overallQuality.toFixed(2)}`);
  return validation;
}

function calculateRelevanceScore(query: string, results: ProductResult[], queryIntent: any): number {
  if (results.length === 0) return 0;
  
  const queryLower = query.toLowerCase();
  let totalRelevance = 0;
  
  for (const result of results) {
    let productRelevance = 0;
    
    // Exact product name match
    if (result.product_name.toLowerCase().includes(queryLower)) {
      productRelevance += 0.4;
    }
    
    // Brand match
    if (result.brand && result.brand.toLowerCase().includes(queryLower)) {
      productRelevance += 0.3;
    }
    
    // Summary relevance
    const summaryWords = result.summary.toLowerCase().split(' ');
    const queryWords = queryLower.split(' ');
    const wordMatches = queryWords.filter(word => 
      summaryWords.some(summaryWord => summaryWord.includes(word))
    ).length;
    productRelevance += (wordMatches / queryWords.length) * 0.3;
    
    totalRelevance += productRelevance;
  }
  
  return Math.min(1.0, totalRelevance / results.length);
}

function calculateDiversityScore(results: ProductResult[]): number {
  if (results.length <= 1) return results.length > 0 ? 1.0 : 0;
  
  // Check brand diversity
  const brands = new Set(results.map(r => r.brand.toLowerCase()));
  const brandDiversity = brands.size / results.length;
  
  // Check source diversity
  const sourceDomains = new Set();
  results.forEach(result => {
    result.sources.forEach(source => {
      try {
        const domain = new URL(source.url).hostname;
        sourceDomains.add(domain);
      } catch {
        // Invalid URL, skip
      }
    });
  });
  
  const sourceDiversity = Math.min(1.0, sourceDomains.size / (results.length * 2));
  
  // Check product type diversity (if applicable)
  const productTypes = new Set();
  results.forEach(result => {
    const name = result.product_name.toLowerCase();
    if (name.includes('serum')) productTypes.add('serum');
    else if (name.includes('cream')) productTypes.add('cream');
    else if (name.includes('cleanser')) productTypes.add('cleanser');
    else if (name.includes('moisturizer')) productTypes.add('moisturizer');
    else productTypes.add('other');
  });
  
  const typeDiversity = productTypes.size > 1 ? 0.8 : 0.5;
  
  return (brandDiversity * 0.4 + sourceDiversity * 0.4 + typeDiversity * 0.2);
}

function calculateFreshnessScore(results: ProductResult[]): number {
  if (results.length === 0) return 0;
  
  const currentYear = new Date().getFullYear();
  let freshnessSum = 0;
  
  for (const result of results) {
    let resultFreshness = 0.5; // Base freshness
    
    // Check for current year mentions
    if (result.summary.includes(currentYear.toString()) || 
        result.product_name.includes(currentYear.toString())) {
      resultFreshness += 0.3;
    }
    
    // Check for recent year mentions
    if (result.summary.includes((currentYear - 1).toString())) {
      resultFreshness += 0.2;
    }
    
    // Check source titles for freshness indicators
    const hasFreshSources = result.sources.some(source => 
      source.title.includes(currentYear.toString()) ||
      source.title.includes('2024') ||
      source.title.includes('latest') ||
      source.title.includes('new')
    );
    
    if (hasFreshSources) {
      resultFreshness += 0.2;
    }
    
    freshnessSum += Math.min(1.0, resultFreshness);
  }
  
  return freshnessSum / results.length;
}

function calculateCredibilityScore(results: ProductResult[]): number {
  if (results.length === 0) return 0;
  
  let credibilitySum = 0;
  
  for (const result of results) {
    let resultCredibility = 0.5; // Base credibility
    
    // High mention frequency indicates credibility
    if (result.mention_frequency >= 3) {
      resultCredibility += 0.2;
    } else if (result.mention_frequency >= 2) {
      resultCredibility += 0.1;
    }
    
    // Quality score from extraction
    resultCredibility += result.quality_score * 0.3;
    
    // Check for expert sources
    const hasExpertSources = result.sources.some(source => 
      source.title.toLowerCase().includes('dermatologist') ||
      source.title.toLowerCase().includes('expert') ||
      source.title.toLowerCase().includes('professional') ||
      source.url.includes('healthline') ||
      source.url.includes('dermato')
    );
    
    if (hasExpertSources) {
      resultCredibility += 0.2;
    }
    
    credibilitySum += Math.min(1.0, resultCredibility);
  }
  
  return credibilitySum / results.length;
}

function generateImprovementSuggestions(
  relevance: number,
  diversity: number,
  freshness: number,
  credibility: number,
  resultCount: number
): string[] {
  const suggestions: string[] = [];
  
  if (relevance < 0.6) {
    suggestions.push('Consider refining search terms for better relevance');
  }
  
  if (diversity < 0.5) {
    suggestions.push('Results show limited brand/source diversity');
  }
  
  if (freshness < 0.5) {
    suggestions.push('Consider adding "2024" or "latest" to find more recent information');
  }
  
  if (credibility < 0.6) {
    suggestions.push('Results may benefit from more expert sources');
  }
  
  if (resultCount < 3) {
    suggestions.push('Limited results found - try broader search terms');
  }
  
  if (resultCount === 0) {
    suggestions.push('No results found - try alternative spellings or related terms');
    suggestions.push('For books, try searching with author name or alternate title');
    suggestions.push('Consider searching for similar products in the same category');
  }
  
  return suggestions;
}

async function generateResultExplanation(
  query: string,
  results: ProductResult[],
  queryIntent: any,
  overallQuality: number,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<string> {
  if (results.length === 0) {
    return `No products found for "${query}". This could be due to very specific search terms or limited availability of the product in our sources.`;
  }
  
  const topProduct = results[0];
  const qualityDescription = overallQuality > 0.8 ? 'excellent' : 
                           overallQuality > 0.6 ? 'good' : 
                           overallQuality > 0.4 ? 'moderate' : 'limited';
  
  let explanation = `Found ${results.length} product${results.length > 1 ? 's' : ''} for "${query}" with ${qualityDescription} quality. `;
  
  if (queryIntent.type === 'specific_product') {
    explanation += `Searching for the specific product "${topProduct.product_name}" yielded ${topProduct.mention_frequency} mentions across expert sources.`;
  } else if (queryIntent.type === 'category') {
    explanation += `Category search returned diverse options in the ${query} space.`;
  } else if (queryIntent.type === 'comparison') {
    explanation += `Comparison search found products suitable for side-by-side evaluation.`;
  }
  
  if (overallQuality < 0.6) {
    explanation += ' Consider refining your search terms for better results.';
  }
  
  return explanation;
}

export function shouldTriggerFallback(validation: ValidationResult): boolean {
  return validation.overallQuality < 0.4 || validation.relevanceScore < 0.3;
}

export function generateSpellCorrections(query: string): string[] {
  const corrections: string[] = [];
  
  // Common beauty product misspellings
  const commonCorrections: { [key: string]: string } = {
    'eclips': 'eclipse',
    'solaire': 'solaire',
    'cerav': 'cerave',
    'cetaphyl': 'cetaphil',
    'neutrogina': 'neutrogena',
    'moistrizer': 'moisturizer',
    'cleanser': 'cleanser',
    'sunscren': 'sunscreen',
    // Book-specific corrections
    'atomic habbit': 'atomic habits',
    'atomic habit': 'atomic habits',
    'james claire': 'james clear',
    'james cleer': 'james clear',
    'habbit': 'habits'
  };
  
  let corrected = query.toLowerCase();
  let hasCorrection = false;
  
  for (const [wrong, right] of Object.entries(commonCorrections)) {
    if (corrected.includes(wrong)) {
      corrected = corrected.replace(new RegExp(wrong, 'g'), right);
      hasCorrection = true;
    }
  }
  
  if (hasCorrection) {
    corrections.push(corrected);
  }
  
  return corrections;
}
