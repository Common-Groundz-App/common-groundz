
import React from 'react';
import { Link } from 'react-router-dom';

export interface ParsedHashtag {
  original: string;
  normalized: string;
  startIndex: number;
  endIndex: number;
}

export function normalizeHashtag(hashtag: string): string {
  return hashtag
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')         // spaces -> dashes
    .replace(/-+/g, '-')          // collapse multi-dashes
    .replace(/^-|-$/g, '')        // trim leading/trailing dashes
    .replace(/[^a-z0-9_\-]/g, ''); // allow only safe chars (ASCII-only for MVP - future: add Unicode support for i18n)
}

export function parseHashtags(content: string): ParsedHashtag[] {
  const regex = /(\B#)([A-Za-z0-9_][A-Za-z0-9_\-\s]{1,49})/g;
  const hashtags: ParsedHashtag[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const original = match[2].trim();
    const normalized = normalizeHashtag(original);
    
    // Validation: reject if empty after normalization, too short, or numeric-only
    if (normalized.length >= 2 && 
        normalized.length <= 50 && 
        !/^\d+$/.test(normalized)) {
      hashtags.push({
        original,
        normalized,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }
  
  return hashtags;
}

// SAFE linkification using React elements with router navigation
export function renderHashtagLinks(content: string): React.ReactNode[] {
  const hashtags = parseHashtags(content);
  if (hashtags.length === 0) {
    return [content];
  }
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  hashtags.forEach(({ original, normalized, startIndex, endIndex }, index) => {
    // Add text before hashtag
    if (startIndex > lastIndex) {
      parts.push(content.substring(lastIndex, startIndex));
    }
    
    // Add hashtag link using React Router Link for client-side navigation
    parts.push(
      <Link 
        key={`hashtag-${index}`}
        to={`/t/${normalized}`}
        className="text-blue-600 hover:text-blue-800 font-medium"
      >
        #{original}
      </Link>
    );
    
    lastIndex = endIndex;
  });
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  
  return parts;
}
