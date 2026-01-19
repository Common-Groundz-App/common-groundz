import { useState, useRef, useEffect } from 'react';
import { Check, Globe, MoreHorizontal, Plus, Trash2, RotateCcw, X, ArrowUp, Sparkles, User, Search, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePreferences } from '@/contexts/PreferencesContext';
import { PreferenceConfirmationChips, DetectedPreference } from './PreferenceConfirmationChips';
import { createUnifiedConstraint } from '@/utils/constraintUtils';
import { createPreferenceValue } from '@/utils/preferenceRouting';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { RecommendationExplanation } from './RecommendationExplanation';
import { ChatRecommendationCards } from './ChatRecommendationCards';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Source {
  title: string;
  domain: string;
  url: string;
}

// Phase 4: Shortlist and rejected item types (ID-based for frontend entity fetching)
interface ShortlistItem {
  entityId?: string;
  entityName?: string;
  product?: string; // Legacy field name for backwards compatibility
  entityType?: string;
  score: number;
  verified: boolean;
  reason?: string;
  sources: Array<{ type: string; count: number }>;
  signals?: {
    avgRating?: number;
    reviewCount?: number;
  };
}

interface RejectedItem {
  product: string;
  reason: string;
}

interface SourceSummary {
  platformReviews: number;
  similarUsers: number;
  userItems: number;
  webSearchUsed: boolean;
  webSearchAttempted?: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  detectedPreference?: DetectedPreference | null;
  preferenceActionTaken?: 'saved_avoid' | 'saved_preference' | 'dismissed' | null;
  sources?: Source[];
  // Phase 0: Resolver confidence data
  confidenceLabel?: 'high' | 'medium' | 'limited' | null;
  resolverState?: 'success' | 'insufficient_data' | 'web_fallback' | null;
  // Phase 4: Full transparency data
  sourceSummary?: SourceSummary | null;
  shortlist?: ShortlistItem[] | null;
  rejected?: RejectedItem[] | null;
}

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInterface({ isOpen, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { addUnifiedConstraint, addPreferenceValue } = usePreferences();

  // Sync textarea height to content
  const syncTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  // Sync height when input changes programmatically
  useEffect(() => {
    syncTextareaHeight();
  }, [input]);

  // Conditional desktop focus on open
  useEffect(() => {
    if (!isOpen) return;
    
    // Only auto-focus on desktop (pointer devices, not touch)
    const isDesktop = window.matchMedia('(min-width: 640px) and (hover: hover)').matches;
    if (isDesktop) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Mobile scroll lock when chat is open
  useEffect(() => {
    if (!isOpen) return;
    
    // Only lock scroll on mobile (when backdrop would be visible)
    const isMobileViewport = window.matchMedia('(max-width: 639px)').matches;
    if (isMobileViewport) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  // Process inline formatting: bold and citations
  const processInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (/^\[\d+\]$/.test(part)) {
        return (
          <span key={i} className="text-[10px] text-muted-foreground align-super ml-0.5">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Preprocess markdown text to ensure proper line structure for the renderer
  const preprocessMarkdown = (text: string): string => {
    // EARLY RETURN: Skip if nothing needs formatting
    const needsFormatting = 
      /\s---\s|^---$/m.test(text) ||  // Has --- separator
      /(?:💧|🌲|🛠️|🏔️|🏆|⭐|🎯|🔥|✨|📦|🛒|💡|🎬|📚|🍽️|🏠|🚗|💻|📱|🎮|🎵|👕|💄|🧴|🏋️|⚽|🎨|✈️|🐕|👶)/.test(text) ||  // Has section emojis
      /[.!?:,]\s*[•\-*]\s+\S/.test(text) ||  // Has inline bullets
      /\*\*[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3}\*\*/.test(text) ||  // Bold brand (1-4 Title Case words)
      /[•*]\s*\*\*[A-Z]/.test(text);  // Bullet + bold pattern
      
    if (!needsFormatting) return text;
    
    let result = text;
    
    // RULE 0: Extract inline brand headers to their own lines (CRITICAL - runs first)
    // Pattern: punctuation followed by optional bullet + bold brand (1-4 words) + colon
    result = result.replace(
      /([.!?:])\s*(?:[•*]\s*)?\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})\*\*:/g,
      '$1\n\n### **$2**\n'
    );
    
    // Handle: "starting with **Brand**." embedded in paragraphs
    result = result.replace(
      /(starting with|recommend|try|consider|check out)\s*\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})\*\*\.\s*/gi,
      '$1:\n\n### **$2**\n\n'
    );
    
    // Force standalone bold brand lines to become headings (allow trailing whitespace)
    result = result.replace(
      /^\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})\*\*\s*$/gm,
      '### **$1**'
    );
    
    // Also catch: **Brand Name** followed by newline + paragraph content
    result = result.replace(
      /^(\*\*[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3}\*\*)\s*\n(?=\S)/gm,
      '### $1\n'
    );
    
    // RULE 1: Remove visual garbage (NARROW SCOPE - only actual --- separators)
    result = result.replace(/\s---\s/g, '\n\n');  // Inline " --- " becomes line break
    result = result.replace(/^---$/gm, '');        // Standalone --- line removed
    result = result.replace(/:\s*---\s*/g, ':\n\n'); // ": ---" pattern
    result = result.replace(/—\s*—\s*—/g, '');     // Em-dash separators
    
    // RULE 2: Convert emoji headers to ### heading format
    const emojiList = '💧|🌲|🛠️|🏔️|🏆|⭐|🎯|🔥|✨|📦|🛒|💡|🎬|📚|🍽️|🏠|🚗|💻|📱|🎮|🎵|👕|💄|🧴|🏋️|⚽|🎨|✈️|🐕|👶';
    
    // Pattern: punctuation followed by emoji + brand name (inline header)
    const emojiHeaderPattern = new RegExp(
      `([.!?:,])\\s*((?:${emojiList})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?)`,
      'g'
    );
    result = result.replace(emojiHeaderPattern, '$1\n\n### $2');
    
    // RULE 3: Ensure standalone emoji lines become headings
    result = result.replace(
      new RegExp(`^((?:${emojiList})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?)$`, 'gm'),
      '### $1'
    );
    
    // RULE 4: Force inline bullets onto new lines (NARROW SCOPE)
    result = result.replace(/([.!?])\s*([•])\s+/g, '$1\n$2 ');
    result = result.replace(/([.!?])\s*(\*)\s+(?=[A-Z])/g, '$1\n• ');
    
    // RULE 5: Merge orphaned emoji lines with next line
    result = result.replace(
      new RegExp(`^((?:${emojiList}))\\s*\\n\\s*(\\*?\\*?[A-Z])`, 'gm'),
      '### $1 $2'
    );
    
    // RULE 6: Normalize excessive line breaks
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result.trim();
  };

  // Non-brand headings that should NOT get emoji decoration
  // NOTE: Expand this list over time as we observe false positives
  const NON_BRAND_HEADINGS = [
    'Pros', 'Cons', 'Things', 'Things To Consider', 'Recommendations',
    'Summary', 'Conclusion', 'Overview', 'Key Features', 'Features',
    'Benefits', 'Drawbacks', 'Alternatives', 'Options', 'Tips', 'Notes',
    'Warning', 'Important', 'Final Verdict', 'My Experience', 'Who This Is For',
    'Quick Take', 'Bottom Line', 'What To Know', 'The Verdict', 'In Summary'
  ];

  // Simple hash function to get stable index from string
  // Ensures same brand always gets same emoji (no flicker on re-render)
  const getStableIndex = (str: string, arrayLength: number): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % arrayLength;
  };

  // Pick emoji from array using stable hash (same input = same output)
  const pickStable = (emojis: string[], seed: string): string => {
    return emojis[getStableIndex(seed, emojis.length)];
  };

  // Check if heading text looks like a brand name (Title Case, 1-4 words)
  const isBrandHeading = (text: string): boolean => {
    const cleaned = text.replace(/\*\*/g, '').trim();
    if (NON_BRAND_HEADINGS.some(h => h.toLowerCase() === cleaned.toLowerCase())) {
      return false;
    }
    return /^[A-Z][a-zA-Z]+(\s[A-Z][a-zA-Z]+){0,3}$/.test(cleaned);
  };

  // Get category-appropriate emoji for brand headers (stable per brand)
  const getBrandEmoji = (brandName: string, contextText?: string): string => {
    const lowerBrand = brandName.toLowerCase();
    const lowerContext = (contextText || '').toLowerCase();
    const combined = lowerBrand + ' ' + lowerContext;

    if (/hydro|flask|bottle|water|drink|stanley|kanteen|yeti|nalgene|thermos|tumbler/i.test(combined)) {
      return pickStable(['💧', '🚰', '🥤', '🧊'], brandName);
    }
    if (/cerave|skincare|skin|beauty|serum|moistur|cleanser|sunscreen|retinol|lotion|cream|cosmetic/i.test(combined)) {
      return pickStable(['✨', '💄', '🧴', '💅'], brandName);
    }
    if (/patagonia|outdoor|eco|hiking|camping|trail|nature|sustainable|north face|rei/i.test(combined)) {
      return pickStable(['🌲', '🏔️', '🌿', '🏕️'], brandName);
    }
    if (/sony|apple|samsung|laptop|phone|headphone|speaker|tech|computer|tablet|airpod|pixel/i.test(combined)) {
      return pickStable(['💻', '📱', '🎧', '⚡'], brandName);
    }
    if (/food|restaurant|cafe|kitchen|recipe|meal|cook|eat|dining|bistro/i.test(combined)) {
      return pickStable(['🍽️', '🍴', '👨‍🍳', '🥗'], brandName);
    }
    if (/fashion|cloth|wear|shirt|shoe|dress|style|outfit|nike|adidas|levi/i.test(combined)) {
      return pickStable(['👕', '👗', '👟', '🧥'], brandName);
    }
    if (/home|house|furniture|decor|room|living|bedroom|ikea|wayfair/i.test(combined)) {
      return pickStable(['🏠', '🛋️', '🏡', '🪴'], brandName);
    }
    if (/fitness|gym|workout|exercise|sport|run|yoga|peloton|lululemon/i.test(combined)) {
      return pickStable(['🏋️', '💪', '🏃', '🧘'], brandName);
    }
    return pickStable(['⭐', '✨', '🌟', '💫'], brandName);
  };

  // Semantic emoji decoration for conversational tone
  // GUARDRAILS:
  // - One emoji per paragraph (first match wins)
  // - Skip long paragraphs (>160 chars)
  // - Skip list items and quotes (precise regex)
  const getSemanticEmoji = (text: string): { emoji: string; position: 'prepend' | 'none' } => {
    const trimmedText = text.trim();
    
    // GUARDRAIL 1: Skip long paragraphs (explanatory text shouldn't get emojis)
    if (trimmedText.length > 160) {
      return { emoji: '', position: 'none' };
    }
    
    // GUARDRAIL 2: Never decorate list items, numbered lists, or blockquotes
    // Precise regex: only matches "1. ", "- ", "• ", "* ", "> "
    if (/^(\d+\.\s|[-•*>]\s)/.test(trimmedText)) {
      return { emoji: '', position: 'none' };
    }
    
    const lowerText = trimmedText.toLowerCase();
    
    // GUARDRAIL 3: First match wins (one emoji per paragraph)
    
    // Recommendations / suggestions
    if (/^(i'd recommend|i recommend|my recommendation|i suggest|i'd suggest|my top pick|my pick)/i.test(lowerText)) {
      return { emoji: '👉', position: 'prepend' };
    }
    
    // Best for / Good for
    if (/^(best for|good for|great for|ideal for|perfect for)/i.test(lowerText)) {
      return { emoji: '✅', position: 'prepend' };
    }
    
    // Tips / advice
    if (/^(tip:|pro tip:|quick tip:|here's a tip|one tip)/i.test(lowerText)) {
      return { emoji: '💡', position: 'prepend' };
    }
    
    // Warnings / downsides / considerations
    if (/^(warning:|note:|keep in mind|be aware|however,|one downside|the downside|watch out)/i.test(lowerText)) {
      return { emoji: '⚠️', position: 'prepend' };
    }
    
    // Final verdict / conclusion
    if (/^(overall,|in summary|to summarize|final verdict|bottom line|in conclusion|all in all)/i.test(lowerText)) {
      return { emoji: '🏁', position: 'prepend' };
    }
    
    // Comparisons
    if (/^(compared to|in comparison|versus|vs\.|when comparing)/i.test(lowerText)) {
      return { emoji: '⚖️', position: 'prepend' };
    }
    
    // Price / value mentions
    if (/^(price-wise|in terms of price|for the price|value for money|budget-friendly)/i.test(lowerText)) {
      return { emoji: '💰', position: 'prepend' };
    }
    
    // Sustainability / eco (only short mentions)
    if (/^.{0,50}(sustainable|eco-friendly|environmentally|green choice)/i.test(lowerText)) {
      return { emoji: '🌱', position: 'prepend' };
    }
    
    // Durability / quality
    if (/^(built to last|durable|long-lasting|high quality|premium quality)/i.test(lowerText)) {
      return { emoji: '🛠️', position: 'prepend' };
    }
    
    // Questions back to user
    if (/^(would you like|do you want|shall i|should i|can i help|anything else)/i.test(lowerText)) {
      return { emoji: '🤔', position: 'prepend' };
    }
    
    // Hope this helps / happy to help (sign-offs)
    if (/^.{0,30}(hope this helps|happy to help|let me know|feel free to ask)/i.test(lowerText)) {
      return { emoji: '😊', position: 'prepend' };
    }
    
    return { emoji: '', position: 'none' };
  };

  // Simple markdown-to-JSX renderer
  const renderMarkdown = (content: string) => {
    const preprocessed = preprocessMarkdown(content);
    const lines = preprocessed.split('\n');
    
    // GUARDRAIL 4: Global emoji cap per message (max 4 semantic emojis)
    let semanticEmojiCount = 0;
    const MAX_SEMANTIC_EMOJIS = 4;
    
    return lines.map((line, idx) => {
      // Horizontal divider
      if (line.trim() === '---') {
        return <hr key={idx} className="my-2 border-border/50" />;
      }
      
      // Headings (### text, ## text, # text) - render as styled text, no hash marks
      const headingMatch = line.trim().match(/^(#{1,3})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];
        const sizes: Record<number, string> = {
          1: 'text-base font-bold mt-3 mb-1',
          2: 'text-sm font-semibold mt-2 mb-1',
          3: 'text-sm font-medium mt-2 mb-0.5'
        };
        
        // Check if this looks like a brand heading and add emoji decoration
        const shouldDecorate = isBrandHeading(headingText);
        const emoji = shouldDecorate ? getBrandEmoji(headingText.replace(/\*\*/g, '').trim(), content) : '';
        
        return (
          <div key={idx} className={sizes[level] || sizes[3]}>
            {emoji && <span className="mr-1.5">{emoji}</span>}
            {processInline(headingText)}
          </div>
        );
      }
      
      // Bullet points (•, -, *) - ensure bullet and text stay together
      const bulletMatch = line.trim().match(/^[•\-\*]\s*(.*)$/);
      if (bulletMatch) {
        const bulletContent = bulletMatch[1].trim();
        if (!bulletContent) return null; // Skip empty bullet lines
        return (
          <div key={idx} className="flex gap-2 ml-2 my-0.5">
            <span className="text-muted-foreground shrink-0">•</span>
            <span className="flex-1">{processInline(bulletContent)}</span>
          </div>
        );
      }
      
      // Numbered list
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-muted-foreground">{numMatch[1]}.</span>
            <span>{processInline(numMatch[2])}</span>
          </div>
        );
      }
      
      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }
      
      // Regular paragraph - with semantic emoji decoration (capped)
      const semanticDecor = getSemanticEmoji(line);
      if (semanticDecor.emoji && semanticDecor.position === 'prepend' && semanticEmojiCount < MAX_SEMANTIC_EMOJIS) {
        semanticEmojiCount++;
        return (
          <p key={idx}>
            <span className="mr-1.5">{semanticDecor.emoji}</span>
            {processInline(line)}
          </p>
        );
      }
      return <p key={idx}>{processInline(line)}</p>;
    });
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Map scope to preference field
  const scopeToPreferenceField = (scope: string): string => {
    const mapping: Record<string, string> = {
      'food': 'food_preferences',
      'skincare': 'skin_type',
      'haircare': 'hair_type',
      'entertainment': 'genre_preferences',
      'health': 'lifestyle',
      'general': 'lifestyle',
    };
    return mapping[scope] || 'lifestyle';
  };

  // Map scope to constraint scope
  const scopeToConstraintScope = (scope: string): 'global' | 'skincare' | 'food' | 'entertainment' => {
    const mapping: Record<string, 'global' | 'skincare' | 'food' | 'entertainment'> = {
      'food': 'food',
      'skincare': 'skincare',
      'haircare': 'skincare',
      'entertainment': 'entertainment',
      'health': 'global',
      'general': 'global',
    };
    return mapping[scope] || 'global';
  };

  const handleSaveAsAvoid = async (messageId: string, pref: DetectedPreference) => {
    // Use detected targetType with defensive fallback - cast to the correct type
    const detectedType = (pref.targetType || 'ingredient') as 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule';
    
    // Create unified constraint using utility function (note: order is targetType, targetValue, options)
    const constraint = createUnifiedConstraint(
      detectedType,
      pref.value,
      { scope: scopeToConstraintScope(pref.scope) }
    );

    // Save to local preferences context
    addUnifiedConstraint(constraint);

    // Update message state
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, preferenceActionTaken: 'saved_avoid' as const } : m
    ));
    
    toast({ title: "Added to Things to Avoid" });
  };

  const handleSaveAsPreference = async (messageId: string, pref: DetectedPreference) => {
    // Map scope to canonical category field
    const fieldMap: Record<string, string> = {
      'food': 'food_preferences',
      'skincare': 'skin_type',
      'haircare': 'hair_type',
      'entertainment': 'genre_preferences',
      'health': 'lifestyle',
      'general': 'lifestyle',
    };
    const field = fieldMap[pref.scope] || 'lifestyle';
    
    // Create preference value using utility function
    // Signature: createPreferenceValue(value, source, intent?, confidence?, evidence?)
    const preferenceValue = createPreferenceValue(
      pref.value,
      'chatbot' as const, // source
      'like' as const // intent
    );

    // Save to local preferences context (requires field and value)
    addPreferenceValue(field, preferenceValue);

    // Update message state
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, preferenceActionTaken: 'saved_preference' as const } : m
    ));
    
    toast({ title: "Saved to Your Preferences" });
  };

  const handleDismissPreference = async (messageId: string, pref: DetectedPreference) => {
    // Mark as dismissed so it won't appear in LFC
    await markPreferenceAsDismissedInMemory(pref.value, pref.scope, 'dismissed_inline');
    
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, preferenceActionTaken: 'dismissed' as const } : m
    ));
  };

  const markPreferenceAsDismissedInMemory = async (value: string, scope: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing } = await supabase
        .from('user_conversation_memory')
        .select('metadata')
        .eq('user_id', user.id)
        .maybeSingle();

      const metadata = (existing?.metadata as Record<string, any>) || {};
      const dismissedInline = (metadata.dismissed_inline as any[]) || [];

      dismissedInline.push({
        value: value.toLowerCase(),
        scope,
        reason,
        dismissedAt: new Date().toISOString(),
        dismissedVia: 'inline_chip'
      });

      const updatedMetadata = { ...metadata, dismissed_inline: dismissedInline };

      if (existing) {
        await supabase
          .from('user_conversation_memory')
          .update({ metadata: updatedMetadata })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_conversation_memory')
          .insert([{
            user_id: user.id,
            memory_type: 'conversation',
            memory_summary: 'User preferences memory',
            metadata: updatedMetadata
          }]);
      }
    } catch (err) {
      console.error('Error marking preference as dismissed:', err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = input;
    setInput('');
    // Reset textarea height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Call the smart-assistant edge function
      const { data, error } = await supabase.functions.invoke('smart-assistant', {
        body: {
          conversationId: conversationId,
          message: messageText,
          context: {
            // Add any relevant context here (e.g., entity ID if viewing product page)
          }
        }
      });

      if (error) {
        console.error('Error calling assistant:', error);
        throw error;
      }

      // Update conversation ID if this was a new conversation
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add assistant's response to messages with detected preference
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        createdAt: new Date(),
        detectedPreference: data.detectedPreference || null,
        preferenceActionTaken: null,
        sources: data.sources || [],
        confidenceLabel: data.confidenceLabel || null,
        resolverState: data.resolverState || null,
        // Phase 4: Full transparency data
        sourceSummary: data.sourceSummary || null,
        shortlist: data.shortlist || null,
        rejected: data.rejected || null,
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Extract user-friendly error message
      const errorMessage = error instanceof Error ? error.message : "Failed to send message. Please try again.";
      
      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });

      // Add error message to chat
      const assistantErrorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, ${errorMessage}`,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
    toast({
      title: "New conversation started",
      description: "Previous conversation saved",
    });
  };

  // Handle delete click - skip confirmation for empty state
  const handleDeleteClick = () => {
    if (!conversationId) {
      // Empty state: no conversation to delete, just clear local state
      setMessages([]);
      setInput('');
      toast({ title: "Chat cleared" });
      return;
    }
    // Has conversation: show confirmation dialog
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmed = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      
      setMessages([]);
      setConversationId(null);
      setInput('');
      setShowDeleteConfirm(false);
      
      toast({
        title: "Conversation deleted",
        description: "Messages have been removed",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetConfirmed = async () => {
    setIsResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const { error } = await supabase
        .from('user_conversation_memory')
        .delete()
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setShowResetConfirm(false);
      toast({
        title: "Memory reset",
        description: "All learned preferences have been cleared",
      });
    } catch (error) {
      console.error('Error resetting memory:', error);
      toast({
        title: "Error",
        description: "Failed to reset memory",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Handle suggestion click - set input AND sync height
  const handleSuggestionClick = (text: string) => {
    setInput(text);
    // Use requestAnimationFrame to ensure state has updated
    requestAnimationFrame(() => syncTextareaHeight());
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile backdrop - CSS controlled, scroll locked via effect */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Chat container - pure CSS responsive */}
      <div 
        className={cn(
          "fixed z-50 bg-background border border-border/40 shadow-xl overflow-hidden flex flex-col",
          // Mobile: near full-screen
          "bottom-16 left-2 right-2 top-16 rounded-2xl",
          // Desktop: fixed size, right side
          "sm:bottom-24 sm:left-auto sm:top-auto sm:right-6 sm:w-96 sm:h-[600px]"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Chat assistant"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h3 className="font-semibold text-foreground">Assistant</h3>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" aria-label="Chat options">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleNewConversation}>
                  <Plus className="h-4 w-4 mr-2" /> New Chat
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDeleteClick}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  role="menuitem"
                  aria-label="Delete conversation (destructive action)"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Conversation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowResetConfirm(true)}
                  className="text-amber-600 dark:text-amber-400 focus:bg-amber-500/10"
                  role="menuitem"
                  aria-label="Reset memory (warning: clears all preferences)"
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Reset Memory
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted" aria-label="Close chat">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6">
              <div className="flex-1 min-h-[40px]" />
              
              <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6 text-center">
                What can I help with today?
              </h2>
              
              <div className="w-full max-w-sm space-y-1">
                {[
                  { icon: Sparkles, text: "Get personalized recommendations" },
                  { icon: User, text: "What do you know about my preferences?" },
                  { icon: Search, text: "Find products for sensitive skin" },
                  { icon: Heart, text: "Show me my favorite genres" }
                ].map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    onClick={() => handleSuggestionClick(text)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground 
                               hover:text-foreground hover:bg-muted/50 
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-ring
                               rounded-xl transition-colors text-left group"
                  >
                    <Icon className="h-4 w-4 shrink-0 group-hover:text-primary transition-colors" />
                    <span>{text}</span>
                  </button>
                ))}
              </div>
              
              <div className="flex-1 min-h-[40px]" />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id}>
                  {/* Message bubble */}
                  <div
                    className={cn(
                      "flex",
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-transparent text-foreground'
                      )}
                    >
                      {/* CONTEXTUAL HOOK (primes user before cards) */}
                      <div className="space-y-1">
                        {message.role === 'assistant' 
                          ? renderMarkdown(message.content)
                          : <p className="whitespace-pre-wrap">{message.content}</p>
                        }
                      </div>
                      
                      {/* ENTITY CARDS (primary answer after context) */}
                      {message.role === 'assistant' && message.shortlist && message.shortlist.length > 0 && message.shortlist.some(s => s.entityId) && (
                        <div className="mt-3">
                          <ChatRecommendationCards shortlist={message.shortlist} />
                        </div>
                      )}
                      
                      {/* Phase 4: Enhanced Confidence Indicator */}
                      {message.role === 'assistant' && message.confidenceLabel && (
                        <ConfidenceIndicator
                          confidenceLabel={message.confidenceLabel}
                          resolverState={message.resolverState}
                          sourceSummary={message.sourceSummary}
                        />
                      )}

                      {/* Phase 4: Why These Recommendations */}
                      {message.role === 'assistant' && (message.shortlist?.length || message.rejected?.length) && (
                        <RecommendationExplanation
                          shortlist={message.shortlist}
                          rejected={message.rejected}
                        />
                      )}
                      
                      {/* Sources section - clean pill/chip design with favicons */}
                      {message.role === 'assistant' && message.sources && message.sources.length > 0 && (() => {
                        const messageKey = message.id || `msg-${messages.indexOf(message)}`;
                        const isExpanded = expandedSources.has(messageKey);
                        const visibleCount = isExpanded ? message.sources.length : 5;
                        
                        return (
                          <div className="mt-3 pt-2 border-t border-border/40">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground mr-1">Sources:</span>
                              {message.sources.slice(0, visibleCount).map((source, idx) => (
                                <a
                                  key={idx}
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[11px] bg-background border border-border/60 hover:bg-muted px-2.5 py-1 rounded-full transition-colors"
                                >
                                  <img 
                                    src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
                                    alt=""
                                    className="w-3.5 h-3.5 rounded-sm"
                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                                  />
                                  <span>{source.domain}</span>
                                </a>
                              ))}
                              {message.sources.length > 5 && !isExpanded && (
                                <button 
                                  onClick={() => setExpandedSources(prev => {
                                    const next = new Set(prev);
                                    next.add(messageKey);
                                    return next;
                                  })}
                                  className="text-[11px] text-primary hover:underline self-center"
                                >
                                  +{message.sources.length - 5} more
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Preference confirmation chips for assistant messages */}
                  {message.role === 'assistant' && 
                   message.detectedPreference && 
                   !message.preferenceActionTaken && (
                    <PreferenceConfirmationChips
                      preference={message.detectedPreference}
                      onSaveAsAvoid={() => handleSaveAsAvoid(message.id, message.detectedPreference!)}
                      onSaveAsPreference={() => handleSaveAsPreference(message.id, message.detectedPreference!)}
                      onDismiss={() => handleDismissPreference(message.id, message.detectedPreference!)}
                    />
                  )}

                  {/* Confirmation after action */}
                  {message.preferenceActionTaken === 'saved_avoid' && (
                    <div className="flex items-center gap-1 text-xs text-green-600 ml-2 mt-1">
                      <Check className="h-3 w-3" />
                      Added to Things to Avoid
                    </div>
                  )}
                  {message.preferenceActionTaken === 'saved_preference' && (
                    <div className="flex items-center gap-1 text-xs text-green-600 ml-2 mt-1">
                      <Check className="h-3 w-3" />
                      Added to Your Preferences
                    </div>
                  )}
                </div>
              ))}
              
              {/* Accessible typing indicator */}
              {isLoading && (
                <div 
                  className="flex justify-start"
                  role="status"
                  aria-label="Assistant is typing"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-1.5 py-3 px-1" aria-hidden="true">
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce animation-delay-150" />
                    <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce animation-delay-300" />
                  </div>
                  <span className="sr-only">Assistant is typing</span>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input - pill style with auto-expanding textarea */}
        <div className="p-3 sm:p-4 pt-2 border-t border-border/30">
          <div className="flex items-end gap-2 bg-muted/50 dark:bg-muted/30 rounded-2xl 
                          px-4 py-2 border border-border/50 
                          focus-within:border-ring focus-within:ring-1 focus-within:ring-ring
                          transition-colors">
            
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                syncTextareaHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-transparent border-none outline-none text-sm resize-none
                         placeholder:text-muted-foreground min-w-0 max-h-[120px] py-1"
              disabled={isLoading}
              aria-label="Message input"
            />
            
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-8 w-8 rounded-full shrink-0 mb-0.5
                         bg-foreground hover:bg-foreground/90 text-background
                         disabled:bg-muted-foreground/30 disabled:text-muted-foreground
                         transition-colors"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground/60 text-center mt-2">
            AI can make mistakes. Verify important info.
          </p>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Conversation"
        description="Are you sure? This cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
        loadingLabel="Deleting..."
        isLoading={isDeleting}
      />

      <ConfirmationDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetConfirmed}
        title="Reset Memory"
        description="This clears all learned preferences. You'll need to teach the assistant again."
        variant="warning"
        confirmLabel="Reset"
        loadingLabel="Resetting..."
        isLoading={isResetting}
      />
    </>
  );
}
