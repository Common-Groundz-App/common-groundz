
// LLM-based product identification and analysis functions
export async function identifyProductsWithLLM(
  content: string,
  sourceTitle: string,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<string[]> {
  const prompt = `
Analyze this beauty/skincare content and identify SPECIFIC PRODUCT NAMES mentioned:

Content: "${content.substring(0, 2000)}"
Source: "${sourceTitle}"

Rules:
1. Only extract actual product names (e.g., "Eclipse Solaire Active Mattifying Sunscreen", "CeraVe Hydrating Cleanser")
2. Must include brand name + product name
3. Ignore generic terms like "sunscreen", "moisturizer", "cleanser" alone
4. Ignore promotional text like "buy now", "shop", "collection"
5. Focus on products that are being reviewed or recommended

Return a JSON array of product names:
["Product Name 1", "Product Name 2"]

If no specific products found, return: []
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
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const products = JSON.parse(jsonMatch[0]);
          console.log(`🤖 Gemini identified ${products.length} products from ${sourceTitle}`);
          return Array.isArray(products) ? products : [];
        }
      }
    } catch (error) {
      console.error('❌ Gemini product identification failed:', error);
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
            { role: 'system', content: 'You are a product extraction specialist. Always respond with valid JSON arrays.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const products = JSON.parse(jsonMatch[0]);
          console.log(`🤖 OpenAI identified ${products.length} products from ${sourceTitle}`);
          return Array.isArray(products) ? products : [];
        }
      }
    } catch (error) {
      console.error('❌ OpenAI product identification failed:', error);
    }
  }

  // Fallback to regex-based extraction for specific products
  console.log('⚠️ Falling back to regex-based product extraction');
  return extractProductsWithRegex(content);
}

export async function processProductWithEnhancedLLMs(
  productName: string,
  contexts: Array<{ text: string; source_title: string; source_url: string }>,
  mentionCount: number,
  qualityScore: number,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<{ analysis: any; llmUsed: string }> {
  const contextText = contexts.map(ctx => ctx.text).join('\n\n');
  
  const prompt = `
Analyze this product based on expert reviews and recommendations:

Product: "${productName}"
Mentions: ${mentionCount}
Sources: ${contexts.map(ctx => ctx.source_title).join(', ')}

Content:
${contextText.substring(0, 3000)}

Provide analysis in this JSON format:
{
  "summary": "Brief 2-3 sentence summary of the product and its reception",
  "insights": {
    "pros": ["advantage 1", "advantage 2"],
    "cons": ["limitation 1", "limitation 2"],
    "price_range": "price information or 'Price varies'",
    "overall_rating": "expert opinion summary",
    "key_features": ["feature 1", "feature 2"],
    "recommended_by": ["dermatologists", "beauty experts", etc.]
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
            temperature: 0.2,
            topK: 1,
            topP: 1,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return { analysis, llmUsed: 'gemini' };
        }
      }
    } catch (error) {
      console.error('❌ Gemini analysis failed:', error);
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
            { role: 'system', content: 'You are a beauty product analyst. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return { analysis, llmUsed: 'openai' };
        }
      }
    } catch (error) {
      console.error('❌ OpenAI analysis failed:', error);
    }
  }

  // Basic fallback analysis
  return {
    analysis: {
      summary: `${productName} mentioned ${mentionCount} times across expert sources.`,
      insights: {
        pros: [],
        cons: [],
        price_range: "Price varies",
        overall_rating: "Expert mentioned",
        key_features: [],
        recommended_by: []
      }
    },
    llmUsed: 'fallback'
  };
}

function extractProductsWithRegex(content: string): string[] {
  const products: string[] = [];
  
  // Enhanced patterns for specific products
  const specificProductPatterns = [
    /Eclipse Solaire[^.]*?(?:Sunscreen|SPF|Mattifying|Active)[^.]*/gi,
    /CeraVe[^.]*?(?:Cleanser|Moisturizer|Cream|Lotion)[^.]*/gi,
    /Cetaphil[^.]*?(?:Cleanser|Moisturizer|Cream|Lotion)[^.]*/gi,
    /The Ordinary[^.]*?(?:Serum|Acid|Niacinamide|Hyaluronic)[^.]*/gi,
    /Neutrogena[^.]*?(?:Cleanser|Moisturizer|Sunscreen|SPF)[^.]*/gi
  ];

  for (const pattern of specificProductPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleaned = match.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 10 && cleaned.length < 80) {
          products.push(cleaned);
        }
      });
    }
  }

  return [...new Set(products)]; // Remove duplicates
}
