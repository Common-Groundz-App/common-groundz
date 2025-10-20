import { entityTypeConfig, EntityFieldConfig, FieldType } from '../../../shared/config/entityTypeConfig.ts';

/**
 * Generate comprehensive system prompt from shared entity config
 * This ensures AI extraction stays aligned with frontend schema automatically
 */
export function generateSystemPrompt(): string {
  // Extract all entity type keys (exclude 'others')
  const entityTypes = Object.keys(entityTypeConfig).filter(k => k !== 'others');
  
  // Generate field extraction instructions for each type
  const fieldInstructions = entityTypes
    .map(type => {
      const config = entityTypeConfig[type];
      if (!config.fields || config.fields.length === 0) return null;
      
      const fieldList = config.fields
        .map((field: EntityFieldConfig) => {
          let instruction = `    - ${field.key}`;
          
          // Add type hints
          if (field.type === 'tags' || field.type === 'multi-select') {
            instruction += ' (array of strings)';
          } else if (field.type === 'number') {
            instruction += ' (number, not string)';
          }
          
          // Add allowed options for selects
          if (field.options && field.options.length > 0) {
            if (field.type === 'select') {
              instruction += ` (one of: ${field.options.join(', ')})`;
            } else if (field.type === 'multi-select') {
              instruction += ` (array from: ${field.options.join(', ')})`;
            }
          }
          
          // Mark required fields
          if (field.required) {
            instruction += ' [REQUIRED]';
          }
          
          return instruction;
        })
        .join('\n');
      
      return `**${type.toUpperCase()}**:\n${fieldList}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `You are an expert entity analyzer for a recommendation platform. Analyze the URL content and extract ALL relevant structured data.

**SUPPORTED ENTITY TYPES (${entityTypes.length} total)**:
${entityTypes.map(t => `- ${t}`).join('\n')}

**EXTRACTION RULES**:
1. Determine the single most appropriate entity type from the list above
2. Extract a clean, concise name (NOT the website name or domain)
3. Write a 2-3 sentence description summarizing the entity
4. Suggest a category path using ">" separator (e.g., "Books > Fiction > Science Fiction")
5. Generate 3-5 relevant tags (lowercase, hyphen-separated, e.g., "sci-fi", "bestseller")
6. Provide a confidence score (0.0 to 1.0) for your classification
7. Extract the primary image URL from og:image meta tag (full absolute URL or null)
8. Extract ALL type-specific fields listed below that are relevant

**TYPE-SPECIFIC FIELDS TO EXTRACT**:

${fieldInstructions}

**CRITICAL EXTRACTION GUIDELINES**:
- Extract AS MANY relevant fields as possible for the detected type
- For select fields: use EXACT option values from the lists above
- For array fields (tags, multi-select): return array of strings
- For number fields: return actual numbers, NOT strings
- For text fields: return clean strings without HTML or formatting
- Omit fields from additional_data if they are unknown/not found
- DO NOT make up data - only extract what is clearly present

**RETURN FORMAT** (valid JSON only):
\`\`\`json
{
  "type": "product",
  "name": "Product Name",
  "description": "2-3 sentences describing this entity in a clear, engaging way.",
  "suggested_category": "Category > Subcategory > Specific Type",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this classification and extraction is correct.",
  "image_url": "https://example.com/image.jpg",
  "additional_data": {
    "field1": "value",
    "field2": 123,
    "field3": ["array", "values"]
  }
}
\`\`\`

**IMPORTANT**: The additional_data object should contain ALL extracted type-specific fields using the exact keys listed above.`;
}

/**
 * Get field metadata for a specific entity type
 * Used to map AI predictions back into the form
 */
export function getFieldMetadata(entityType: string): Map<string, { storageColumn?: string; fieldType: FieldType }> {
  const config = entityTypeConfig[entityType];
  const mapping = new Map();
  
  if (config && config.fields) {
    config.fields.forEach(field => {
      mapping.set(field.key, {
        storageColumn: field.storageColumn,
        fieldType: field.type
      });
    });
  }
  
  return mapping;
}
