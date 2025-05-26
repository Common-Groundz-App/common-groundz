
import { getEnhancedSourceQualityScore } from "./enhanced-query-analyzer.ts";

interface ProductMention {
  name: string;
  brand?: string;
  description?: string;
  category?: string;
  confidence: number;
  sourceType: 'extracted' | 'curated';
}

interface SourceQuality {
  qualityScore: number;
  expertBias: number;
  freshnessFactor: number;
}

// Curated list of popular books that should always be found
const CURATED_BOOKS = {
  'atomic habits': {
    name: 'Atomic Habits',
    brand: 'James Clear',
    description: 'An Easy & Proven Way to Build Good Habits & Break Bad Ones',
    category: 'books'
  },
  'think and grow rich': {
    name: 'Think and Grow Rich',
    brand: 'Napoleon Hill',
    description: 'The landmark bestseller on motivation and personal success',
    category: 'books'
  },
  'rich dad poor dad': {
    name: 'Rich Dad Poor Dad',
    brand: 'Robert Kiyosaki',
    description: 'What the Rich Teach Their Kids About Money',
    category: 'books'
  }
};

async function extractWithLLM(prompt: string, geminiApiKey?: string, openaiApiKey?: string): Promise<ProductMention[]> {
  console.log(`🤖 LLM Extraction prompt preview: ${prompt.substring(0, 200)}...`);
  
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
        console.log(`🤖 Gemini raw response: ${content}`);
        
        try {
          // Try to extract JSON from the response
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const products = JSON.parse(jsonMatch[0]) as ProductMention[];
            console.log(`✅ Gemini parsed ${products.length} products successfully`);
            return products;
          } else {
            console.log(`⚠️ No JSON array found in Gemini response`);
            return [];
          }
        } catch (jsonError) {
          console.error('❌ Invalid JSON from Gemini:', content, jsonError);
          return [];
        }
      } else {
        console.error('❌ Gemini API error:', response.status, response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ Gemini API call failed:', error);
      return [];
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
            { role: 'system', content: 'You are a product extraction expert. Always respond with valid JSON arrays only. No explanations.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        console.log(`🤖 OpenAI raw response: ${content}`);
        
        try {
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const products = JSON.parse(jsonMatch[0]) as ProductMention[];
            console.log(`✅ OpenAI parsed ${products.length} products successfully`);
            return products;
          } else {
            console.log(`⚠️ No JSON array found in OpenAI response`);
            return [];
          }
        } catch (jsonError) {
          console.error('❌ Invalid JSON from OpenAI:', content, jsonError);
          return [];
        }
      } else {
        console.error('❌ OpenAI API error:', response.status, response.statusText);
        return [];
      }
    } catch (error) {
      console.error('❌ OpenAI API call failed:', error);
      return [];
    }
  }
  
  return [];
}

function calculateSourceQuality(url: string, title: string, intentType: string, categoryHints: string[]): number {
  const domain = new URL(url).hostname;
  return getEnhancedSourceQualityScore(domain, url, title, intentType, categoryHints);
}

export async function enhancedExtractProducts(
  title: string,
  snippet: string,
  url: string,
  intentType: string,
  categoryHints: string[],
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<ProductMention[]> {
  const sourceQuality = calculateSourceQuality(url, title, intentType, categoryHints);
  console.log(`🤖 Enhanced extraction from: ${title} (Quality: ${sourceQuality.toFixed(2)})`);
  
  // Skip low-quality sources
  if (sourceQuality < 0.3) {
    console.log(`⚠️ Skipping low-quality source: ${title}`);
    return [];
  }
  
  // Check for curated books first
  const curatedProducts = checkCuratedBooks(title, snippet, categoryHints);
  if (curatedProducts.length > 0) {
    console.log(`📚 Found ${curatedProducts.length} curated books from ${title}`);
    return curatedProducts;
  }
  
  // Use enhanced prompts based on category hints
  const extractionPrompt = generateCategorySpecificPrompt(title, snippet, categoryHints, intentType);
  
  const products = await extractWithLLM(extractionPrompt, geminiApiKey, openaiApiKey);
  
  console.log(`🤖 LLM identified ${products.length} products from ${title}`);
  
  // Enhanced post-processing based on category
  const enhancedProducts = enhanceCategorySpecificExtraction(products, categoryHints, title, snippet);
  
  console.log(`🎯 Enhanced identification: ${enhancedProducts.length} products from ${title}`);
  
  return enhancedProducts;
}

function checkCuratedBooks(title: string, snippet: string, categoryHints: string[]): ProductMention[] {
  if (!categoryHints.includes('books')) {
    return [];
  }
  
  const combinedText = `${title} ${snippet}`.toLowerCase();
  const foundBooks: ProductMention[] = [];
  
  for (const [searchTerm, bookData] of Object.entries(CURATED_BOOKS)) {
    if (combinedText.includes(searchTerm) || 
        combinedText.includes(bookData.name.toLowerCase()) ||
        combinedText.includes(bookData.brand.toLowerCase())) {
      foundBooks.push({
        ...bookData,
        confidence: 0.95,
        sourceType: 'curated'
      });
    }
  }
  
  return foundBooks;
}

function generateCategorySpecificPrompt(
  title: string,
  snippet: string,
  categoryHints: string[],
  intentType: string
): string {
  const basePrompt = `Extract products from this content:
Title: "${title}"
Content: "${snippet}"`;

  if (categoryHints.includes('books')) {
    return `${basePrompt}

I need you to extract BOOKS mentioned in this content. Look for:
- Book titles (like "Atomic Habits", "Think and Grow Rich")
- Author names (like "James Clear", "Napoleon Hill")
- Any literary works or publications

IMPORTANT: Return ONLY a JSON array like this example:
[
  {
    "name": "Atomic Habits",
    "brand": "James Clear", 
    "description": "Book about building good habits",
    "category": "books",
    "confidence": 0.9,
    "sourceType": "extracted"
  }
]

If you find books, extract them. If no books are mentioned, return: []
NO explanations, just the JSON array.`;
  } else if (categoryHints.includes('beauty')) {
    return `${basePrompt}

Focus on extracting SKINCARE and BEAUTY PRODUCTS mentioned. Look for:
- Specific product names with brands
- Skincare ingredients (serums, creams, cleansers)
- Makeup products
- Beauty tools

Return ONLY a JSON array of objects with: name, brand, description, category.
If no products found, return: []`;
  }
  
  // Default prompt for other categories
  return `${basePrompt}

Extract any specific products mentioned. Look for:
- Brand names and product names
- Specific models or versions
- Recommended items

Return ONLY a JSON array of objects with: name, brand, description, category.
If no products found, return: []`;
}

function enhanceCategorySpecificExtraction(
  products: ProductMention[],
  categoryHints: string[],
  title: string,
  snippet: string
): ProductMention[] {
  if (categoryHints.includes('books')) {
    return enhanceBookExtraction(products, title, snippet);
  }
  
  return products;
}

function enhanceBookExtraction(
  products: ProductMention[],
  title: string,
  snippet: string
): ProductMention[] {
  const enhanced: ProductMention[] = [...products];
  
  // Enhanced book patterns with more variations
  const bookPatterns = [
    /atomic habits/gi,
    /([\w\s]{3,50})\s+by\s+([\w\s]{3,30})/gi, // "Book Title by Author"
    /"([^"]{3,50})"\s*book/gi, // "Book Title" book
    /book[:\s]+["']?([^"']{3,50})["']?/gi, // book: "Title"
    /(think and grow rich)/gi,
    /(rich dad poor dad)/gi,
    /(james clear)/gi,
    /(napoleon hill)/gi
  ];
  
  const combinedText = `${title} ${snippet}`;
  console.log(`📖 Analyzing text for books: ${combinedText.substring(0, 200)}...`);
  
  for (const pattern of bookPatterns) {
    let match;
    while ((match = pattern.exec(combinedText)) !== null) {
      const bookTitle = match[1] || match[0];
      const author = match[2] || null;
      
      if (bookTitle && bookTitle.length > 2) {
        // Check if we already have this book
        const exists = enhanced.some(p => 
          normalizeString(p.name).includes(normalizeString(bookTitle)) ||
          normalizeString(bookTitle).includes(normalizeString(p.name))
        );
        
        if (!exists) {
          console.log(`📚 Pattern match found: "${bookTitle}" by ${author || 'Unknown'}`);
          enhanced.push({
            name: bookTitle.trim(),
            brand: author?.trim() || 'Unknown Author',
            description: `Book mentioned in ${title}`,
            category: 'books',
            confidence: 0.8,
            sourceType: 'extracted'
          });
        }
      }
    }
  }
  
  return enhanced;
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}
