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

async function extractWithLLM(prompt: string, geminiApiKey?: string, openaiApiKey?: string): Promise<ProductMention[]> {
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
        try {
          const products = JSON.parse(content) as ProductMention[];
          return products;
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
            { role: 'system', content: 'You are a product extraction expert. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        try {
          const products = JSON.parse(content) as ProductMention[];
          return products;
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
  
  // Use enhanced prompts based on category hints
  const extractionPrompt = generateCategorySpecificPrompt(title, snippet, categoryHints, intentType);
  
  const products = await extractWithLLM(extractionPrompt, geminiApiKey, openaiApiKey);
  
  console.log(`🤖 Gemini identified ${products.length} products from ${title}`);
  
  // Enhanced post-processing based on category
  const enhancedProducts = enhanceCategorySpecificExtraction(products, categoryHints, title, snippet);
  
  console.log(`🎯 Enhanced identification: ${enhancedProducts.length} products from ${title}`);
  
  return enhancedProducts;
}

function generateCategorySpecificPrompt(
  title: string,
  snippet: string,
  categoryHints: string[],
  intentType: string
): string {
  const basePrompt = `Extract product mentions from this content:
Title: "${title}"
Content: "${snippet}"`;

  if (categoryHints.includes('books')) {
    return `${basePrompt}

Focus on extracting BOOKS, AUTHORS, and LITERARY WORKS mentioned. Look for:
- Book titles (e.g., "Atomic Habits", "Think and Grow Rich")
- Author names (e.g., "James Clear", "Napoleon Hill") 
- Series or collections
- Educational materials, guides, workbooks

For each book found, extract:
- Title (exact name)
- Author (if mentioned)
- Description/summary
- Genre/category if mentioned

Return as JSON array of objects with: name, brand (author), description, category.
Only include actual books/publications, not general topics or concepts.`;
  } else if (categoryHints.includes('beauty')) {
    return `${basePrompt}

Focus on extracting SKINCARE and BEAUTY PRODUCTS mentioned. Look for:
- Specific product names with brands
- Skincare ingredients (serums, creams, cleansers)
- Makeup products
- Beauty tools

Return as JSON array of objects with: name, brand, description, category.`;
  }
  
  // Default prompt for other categories
  return `${basePrompt}

Extract any specific products mentioned. Look for:
- Brand names and product names
- Specific models or versions
- Recommended items

Return as JSON array of objects with: name, brand, description, category.`;
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
  
  // Look for common book patterns in title and snippet
  const bookPatterns = [
    /atomic habits/i,
    /([\w\s]+) by ([\w\s]+)/i, // "Book Title by Author"
    /"([^"]+)" book/i, // "Book Title" book
    /book[:\s]+["']?([^"']+)["']?/i // book: "Title"
  ];
  
  const combinedText = `${title} ${snippet}`.toLowerCase();
  
  for (const pattern of bookPatterns) {
    const matches = combinedText.match(pattern);
    if (matches) {
      const bookTitle = matches[1] || matches[0];
      const author = matches[2] || null;
      
      // Avoid duplicates
      const exists = enhanced.some(p => 
        p.name.toLowerCase().includes(bookTitle.toLowerCase()) ||
        bookTitle.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (!exists && bookTitle.length > 3) {
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
  
  return enhanced;
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '');
}
