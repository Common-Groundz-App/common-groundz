interface QueryIntent {
  type: 'specific_product' | 'category' | 'comparison' | 'brand_exploration';
  confidence: number;
  originalQuery: string;
  optimizedQuery: string;
  searchStrategy: {
    exactMatch: boolean;
    includeReviews: boolean;
    excludeListings: boolean;
    focusOnComparisons: boolean;
  };
  extractedEntities: {
    productName?: string;
    brandName?: string;
    category?: string;
    comparisonTerms?: string[];
  };
}

// Enhanced brand patterns for better recognition
const ENHANCED_BRAND_PATTERNS = [
  // Skincare Brands
  'CeraVe', 'Cetaphil', 'Neutrogena', 'The Ordinary', 'Skinceuticals', 'Olay', 'L\'Oreal',
  'Minimalist', 'Vanicream', 'La Roche-Posay', 'Eucerin', 'Aveeno', 'Dove', 'Garnier',
  'Paula\'s Choice', 'Mad Hippie', 'Timeless', 'Drunk Elephant', 'Glossier', 
  'First Aid Beauty', 'Youth to the People', 'Tatcha', 'Sunday Riley',
  'Kiehl\'s', 'Clinique', 'Estee Lauder', 'Lancome', 'Shiseido', 'Dermalogica',
  'Pixi', 'Bioderma', 'Vichy', 'Avene', 'COSRX', 'Some By Mi', 'Innisfree',
  'Yuderma', 'Eclipse Solaire', // Added specific products as potential brands
  
  // Indian Brands
  'Himalaya', 'Lakme', 'Lotus', 'Biotique', 'Forest Essentials', 'Kama Ayurveda',
  'Plum', 'MCaffeine', 'Mamaearth', 'The Body Shop', 'Nykaa', 'Sugar Cosmetics',
  'Colorbar', 'Faces Canada', 'Blue Heaven', 'Revlon', 'WOW Skin Science'
];

const SPECIFIC_PRODUCT_PATTERNS = [
  'Eclipse Solaire', 'Hyaluronic Acid', 'Niacinamide', 'Vitamin C Serum',
  'Retinol', 'Salicylic Acid', 'AHA BHA', 'Sunscreen SPF'
];

export async function analyzeQueryIntent(
  query: string,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<QueryIntent> {
  console.log(`🧠 Analyzing query intent for: "${query}"`);
  
  // Quick pattern-based analysis first
  const quickAnalysis = performQuickAnalysis(query);
  
  // If we have high confidence from quick analysis, use it
  if (quickAnalysis.confidence > 0.8) {
    console.log(`✅ High confidence quick analysis: ${quickAnalysis.type}`);
    return quickAnalysis;
  }
  
  // Otherwise, use LLM for more nuanced understanding
  const llmAnalysis = await performLLMAnalysis(query, geminiApiKey, openaiApiKey);
  
  // Combine quick analysis with LLM analysis
  const finalAnalysis = combineAnalyses(quickAnalysis, llmAnalysis);
  
  console.log(`🎯 Final query analysis: ${finalAnalysis.type} (confidence: ${finalAnalysis.confidence})`);
  return finalAnalysis;
}

function performQuickAnalysis(query: string): QueryIntent {
  const lowerQuery = query.toLowerCase().trim();
  
  // Check for specific product mentions
  for (const product of SPECIFIC_PRODUCT_PATTERNS) {
    if (lowerQuery.includes(product.toLowerCase())) {
      return {
        type: 'specific_product',
        confidence: 0.9,
        originalQuery: query,
        optimizedQuery: generateOptimizedQuery(query, 'specific_product'),
        searchStrategy: {
          exactMatch: true,
          includeReviews: true,
          excludeListings: true,
          focusOnComparisons: false
        },
        extractedEntities: {
          productName: product,
          brandName: extractBrandFromQuery(query)
        }
      };
    }
  }
  
  // Check for comparison patterns
  if (lowerQuery.includes(' vs ') || lowerQuery.includes(' versus ') || 
      lowerQuery.includes('compare') || lowerQuery.includes('difference between')) {
    return {
      type: 'comparison',
      confidence: 0.85,
      originalQuery: query,
      optimizedQuery: generateOptimizedQuery(query, 'comparison'),
      searchStrategy: {
        exactMatch: false,
        includeReviews: true,
        excludeListings: true,
        focusOnComparisons: true
      },
      extractedEntities: {
        comparisonTerms: extractComparisonTerms(query)
      }
    };
  }
  
  // Check for brand exploration
  const brandMentioned = ENHANCED_BRAND_PATTERNS.find(brand => 
    lowerQuery.includes(brand.toLowerCase())
  );
  
  if (brandMentioned && (lowerQuery.includes('products') || lowerQuery.includes('range') || 
      lowerQuery.includes('collection') || lowerQuery.includes('all'))) {
    return {
      type: 'brand_exploration',
      confidence: 0.8,
      originalQuery: query,
      optimizedQuery: generateOptimizedQuery(query, 'brand_exploration'),
      searchStrategy: {
        exactMatch: false,
        includeReviews: true,
        excludeListings: false,
        focusOnComparisons: false
      },
      extractedEntities: {
        brandName: brandMentioned
      }
    };
  }
  
  // Default to category search
  return {
    type: 'category',
    confidence: 0.6,
    originalQuery: query,
    optimizedQuery: generateOptimizedQuery(query, 'category'),
    searchStrategy: {
      exactMatch: false,
      includeReviews: true,
      excludeListings: true,
      focusOnComparisons: false
    },
    extractedEntities: {
      category: extractCategory(query)
    }
  };
}

async function performLLMAnalysis(
  query: string,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<Partial<QueryIntent>> {
  const prompt = `
Analyze this beauty/skincare search query and classify its intent:

Query: "${query}"

Classify as one of:
1. specific_product - User wants info about ONE specific product (e.g., "Eclipse Solaire", "CeraVe Hydrating Cleanser")
2. category - User wants recommendations in a category (e.g., "best vitamin C serum", "moisturizer for dry skin")
3. comparison - User wants to compare products (e.g., "CeraVe vs Cetaphil", "compare retinol serums")
4. brand_exploration - User wants to explore a brand's products (e.g., "Yuderma products", "The Ordinary range")

Return JSON:
{
  "type": "specific_product|category|comparison|brand_exploration",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "extractedEntities": {
    "productName": "exact product name if specific_product",
    "brandName": "brand name if mentioned",
    "category": "product category if category search",
    "comparisonTerms": ["term1", "term2"] if comparison
  }
}
`;

  // Try Gemini first
  if (geminiApiKey) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 512,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          console.log(`🤖 Gemini query analysis: ${analysis.type} (${analysis.confidence})`);
          return analysis;
        }
      }
    } catch (error) {
      console.error('❌ Gemini query analysis failed:', error);
    }
  }
  
  // Fallback to OpenAI
  if (openaiApiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a search intent classifier. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          console.log(`🤖 OpenAI query analysis: ${analysis.type} (${analysis.confidence})`);
          return analysis;
        }
      }
    } catch (error) {
      console.error('❌ OpenAI query analysis failed:', error);
    }
  }
  
  return { confidence: 0 };
}

function combineAnalyses(quick: QueryIntent, llm: Partial<QueryIntent>): QueryIntent {
  // If LLM has high confidence and different result, use LLM
  if (llm.confidence && llm.confidence > 0.8 && llm.type !== quick.type) {
    return {
      ...quick,
      type: llm.type!,
      confidence: llm.confidence,
      extractedEntities: { ...quick.extractedEntities, ...llm.extractedEntities }
    };
  }
  
  // Otherwise, use quick analysis but enhance with LLM insights
  return {
    ...quick,
    confidence: Math.max(quick.confidence, llm.confidence || 0),
    extractedEntities: { ...quick.extractedEntities, ...llm.extractedEntities }
  };
}

function generateOptimizedQuery(originalQuery: string, intentType: string): string {
  const baseQuery = originalQuery.trim();
  
  switch (intentType) {
    case 'specific_product':
      // For specific products, use exact match with review focus
      return `"${baseQuery}" review dermatologist recommended -"buy online" -"shop now" -"add to cart" -"collection" -"range"`;
    
    case 'comparison':
      // For comparisons, focus on comparison content
      return `${baseQuery} comparison review "vs" difference -"buy online" -"shop now"`;
    
    case 'brand_exploration':
      // For brand exploration, include product range terms
      return `${baseQuery} products range collection review -"buy online" -"shop now"`;
    
    case 'category':
    default:
      // For category searches, use current approach
      return `${baseQuery} dermatologist recommended review "best" -"buy online" -"shop now" -"add to cart"`;
  }
}

function extractBrandFromQuery(query: string): string | undefined {
  const lowerQuery = query.toLowerCase();
  return ENHANCED_BRAND_PATTERNS.find(brand => 
    lowerQuery.includes(brand.toLowerCase())
  );
}

function extractComparisonTerms(query: string): string[] {
  const terms = query.split(/\s+(?:vs|versus|compare|difference between)\s+/i);
  return terms.map(term => term.trim()).filter(term => term.length > 0);
}

function extractCategory(query: string): string | undefined {
  const categoryKeywords = [
    'cleanser', 'moisturizer', 'serum', 'sunscreen', 'toner', 'exfoliant',
    'mask', 'cream', 'lotion', 'oil', 'treatment', 'foundation', 'concealer'
  ];
  
  const lowerQuery = query.toLowerCase();
  return categoryKeywords.find(category => lowerQuery.includes(category));
}
