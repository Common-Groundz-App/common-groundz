import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";
import {
  findMatchedToken,
  findMatchedSynonym,
  hasRecommendationVerb,
  isLikelyDiscoveryQuery,
  VALID_LLM_CATEGORIES,
  getCategoryFromToken,
  getCategoryFromSynonym
} from "./discovery-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= RECOMMENDATION RESOLVER TYPES (Phase 2 Enhanced) =============

type ResolverState = 'success' | 'insufficient_data' | 'web_fallback';

// Type-safe score source enum (Phase 2)
enum ScoreSource {
  SIMILAR_USER = 'similar_user',
  PLATFORM_REVIEW = 'platform_review',
  USER_HISTORY = 'user_history',
  CONSTRAINT_MATCH = 'constraint_match'
}

// Rejection priority - lower number = higher priority = shown first (ChatGPT Guardrail #3)
const REJECTION_PRIORITY: Record<string, number> = {
  already_owns: 1,
  constraint_violation: 2,
  negative_override: 3,
  previously_used: 4
};

interface ResolverInput {
  userId: string;
  query: string;
  category?: string;
  constraints: string[];
  conversationContext?: Array<{role: string; content: string}>;
}

interface ResolverProductSource {
  type: 'platform_review' | 'similar_user' | 'user_history' | 'web';
  count: number;
}

// ============= PHASE 1: OUTCOME SIGNALS TYPES =============

/**
 * Outcome signals extracted from a single user's interaction with an entity
 * These are pure, cacheable by (userId, entityId)
 */
interface OutcomeSignals {
  usageDurationMonths: number;
  stillUsing: boolean;
  stoppedUsing: boolean;
  hasTimeline: boolean;
  timelineUpdates: number;
  ratingTrajectory: 'improving' | 'declining' | 'stable';
  latestRating: number;
  signalStrength: number;  // 0 to 0.35, computed deterministically
}

/**
 * A product candidate from similar users with aggregated signals
 */
interface CandidateProduct {
  entityId: string;
  entityName: string;
  category: string;
  recommendedByUsers: Array<{
    userId: string;
    signals: OutcomeSignals;
    cappedContribution: number;  // max 0.35 per user
  }>;
  aggregatedSignals: {
    totalUsers: number;
    avgSignalStrength: number;
    avgLatestRating: number;
    stillUsingCount: number;
    stoppedUsingCount: number;
    hasTimelineCount: number;
    distinctUsersWithSignals: number;
  };
}

/**
 * UNIFIED SCORING CONFIGURATION (Phase 2)
 * 
 * Centralized configuration for ALL scoring sources.
 * Weights are FROZEN for Phase 2 - no tuning until real usage data.
 * 
 * ChatGPT Guardrail #1: Freeze weights
 * ChatGPT Guardrail #2: Source dominance ordering via caps:
 *   Similar-user (0.60) > Platform (0.50) > History (0.20) > Preference (0.15)
 */
const UNIFIED_SCORING_CONFIG = {
  // ============= PLATFORM REVIEW SCORING =============
  platformReview: {
    baseWeight: 0.08,
    ratingMultiplier: 0.02,      // per star above 3
    relevanceMultiplier: 0.15,
    recencyDecay: {
      enabled: true,
      decayPerMonth: 0.02,
      maxDecay: 0.20,
      freshBonus: 0.05,
      freshThresholdMonths: 3
    },
    maxContributionPerReview: 0.40,
    maxTotalContribution: 0.50   // ChatGPT Guardrail #2
  },
  
  // ============= SIMILAR USER SCORING =============
  similarUser: {
    maxContributionPerUser: 0.35,
    maxSimilarUserScorePerProduct: 0.60,  // ChatGPT Guardrail #2: Highest cap
    minDistinctUsersForScoring: 2,
    minDistinctUsersForBonus: 2,
    
    weights: {
      stillUsing: 0.25,
      usageDurationPerMonth: 0.033,  // capped at 12 months = 0.40
      maxUsageDurationMonths: 12,
      hasTimeline: 0.15,
      ratingImproving: 0.20,
      ratingDeclining: -0.20,
      ratingStable: 0.10,
      stoppedUsing: -0.40
    },
    
    negativeOverride: {
      minStoppedCount: 2,
      penalty: -0.30,
      triggerWhenStoppedGteStillUsing: true
    },
    
    scoring: {
      base: 0.10,
      signalStrengthMultiplier: 0.25,
      stillUsingPerUser: 0.05,
      timelinePerUser: 0.03,
      stoppedUsingPerUser: -0.08
    },
    
    // Similar-user recency decay (My Addition #2)
    recencyDecay: {
      enabled: true,
      thresholds: [
        { daysAgo: 30, multiplier: 1.0 },
        { daysAgo: 60, multiplier: 0.95 },
        { daysAgo: 90, multiplier: 0.90 }
      ]
    },
    
    activeWithinDays: 90
  },
  
  // ============= USER HISTORY SCORING (NEW Phase 2) =============
  userHistory: {
    maxTotalContribution: 0.20,  // ChatGPT Guardrail #2
    
    currentlyOwns: {
      penalty: -1.0,
      rejectionType: 'already_owns'
    },
    previouslyUsed: {
      penalty: -0.15,
      showWarning: true
    },
    brandLoyalty: {
      bonus: 0.08,
      minLovedItems: 2
    },
    categoryFamiliarity: {
      bonus: 0.05
    }
  },
  
  // ============= CONSTRAINT MATCHING (NEW Phase 2) =============
  constraints: {
    maxTotalContribution: 0.15,  // ChatGPT Guardrail #2
    
    violation: {
      penalty: -1.0,
      rejectionType: 'constraint_violation'
    },
    matchBonus: {
      exactMatch: 0.12,
      partialMatch: 0.06,
      keywordMatch: 0.03
    },
    skinTypeMatch: {
      enabled: true,
      exactMatch: 0.10,
      complementary: 0.05
    }
  },
  
  // ============= GLOBAL CAPS (ChatGPT Guardrail #2) =============
  global: {
    maxTotalScore: 1.5,
    minScoreForShortlist: 0.10,
    dominanceOrder: [
      ScoreSource.SIMILAR_USER,      // 1st: People like you (0.60)
      ScoreSource.PLATFORM_REVIEW,   // 2nd: Platform reviews (0.50)
      ScoreSource.USER_HISTORY,      // 3rd: Your history (0.20)
      ScoreSource.CONSTRAINT_MATCH   // 4th: Preference bonuses (0.15)
    ]
  },
  
  // ============= INSUFFICIENT DATA THRESHOLDS (ChatGPT Final #2) =============
  insufficientData: {
    minSimilarUsers: 2,
    minPlatformReviews: 3,
    minConfidence: 0.30,
    minShortlistItems: 1
  },
  
  // ============= WEB FALLBACK CONFIGURATION (Phase 3) =============
  webFallback: {
    // Trigger conditions
    triggerConditions: {
      confidenceBelow: 0.30,
      shortlistBelow: 2,
      requireBothConditions: true
    },
    
    // Scoring for web results (Guardrail #1)
    scoring: {
      maxScorePerWebResult: 0.35,
      maxTotalWebContribution: 0.40,  // GUARDRAIL: Cap total web influence
      baseScore: 0.20,
      maxWebResultsToAdd: 3
    },
    
    // Search configuration
    search: {
      yearContext: true,
      categoryPrefix: true,
      excludeExistingProducts: true
    },
    
    // Timeout protection (Guardrail #6)
    timeout: {
      maxMs: 5000,
      fallbackOnTimeout: true
    }
  }
};

// Legacy alias for backward compatibility
const OUTCOME_SCORING_CONFIG = UNIFIED_SCORING_CONFIG.similarUser;

// ============= PHASE 2: SCORE BREAKDOWN INTERFACE =============

interface ScoreBreakdown {
  platformReview: {
    total: number;
    reviewCount: number;
    avgRating: number;
    recencyAdjustment: number;
    cappedAt: number | null;
  };
  similarUser: {
    total: number;
    userCount: number;
    avgSignalStrength: number;
    negativeOverride: boolean;
    recencyAdjustment: number;
    cappedAt: number | null;
  };
  userHistory: {
    total: number;
    brandLoyalty: number;
    categoryFamiliarity: number;
    previouslyUsedPenalty: number;
    cappedAt: number | null;
  };
  constraintMatch: {
    total: number;
    matchCount: number;
    skinTypeMatch: boolean;
    cappedAt: number | null;
  };
  rawTotal: number;
  cappedTotal: number;
  dominanceViolation: boolean;
}

// Enhanced shortlist item with factual signals and score breakdown (Phase 2)
interface ResolverShortlistItem {
  product: string;
  entityId?: string;
  reason: string;  // Kept for backward compat, but signals are primary
  score: number;
  
  // Phase 1: Factual signals (LLM converts to language)
  signals?: {
    platformReviews: number;
    avgPlatformRating: number;
    similarUsers: number;
    stillUsingCount: number;
    stoppedUsingCount: number;
    avgUsageDurationMonths: number;
    hasTimelineCount: number;
    ratingTrajectoryPositive: number;
    negativeOverrideApplied: boolean;
  };
  
  // Phase 2 NEW: Score breakdown for transparency
  scoreBreakdown?: ScoreBreakdown;
  
  sources: ResolverProductSource[];
  
  // Phase 3: Web fallback verification (Guardrail #2)
  verified: boolean;
}

// Enhanced rejected item with priority (ChatGPT Guardrail #3)
interface ResolverRejectedItem {
  product: string;
  reason: string;
  rejectionType?: 'already_owns' | 'constraint_violation' | 'negative_override' | 'previously_used';
  priority?: number;
}

interface ResolverUserContext {
  skinType?: string;
  hairType?: string;
  dietaryNeeds?: string[];
  constraints: string[];
  currentProducts: string[];
  stoppedProducts?: string[];  // Phase 2 NEW
  lovedBrands?: string[];      // Phase 2 NEW
  activeCategories?: string[]; // Phase 2 NEW
}

interface ResolverSourceSummary {
  platformReviews: number;
  similarUsers: number;
  userItems: number;
  webSearchUsed: boolean;
  distinctUsersWithSignals?: number;  // Phase 1
  // Phase 3: Web fallback tracking (Guardrail #5)
  webSearchAttempted: boolean;
  webSearchFailureReason?: string;
}

interface ResolverOutput {
  state: ResolverState;
  shortlist: ResolverShortlistItem[];
  rejected: ResolverRejectedItem[];
  userContext: ResolverUserContext;
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'limited';
  sourceSummary: ResolverSourceSummary;
  fallbackMessage?: string;
}

// Type for contributing users log (ChatGPT Refinement #4)
interface ContributingUserLog {
  userId: string;
  signalStrength: number;
  products: string[];
}

// Centralized emoji list for section detection (prevents regex duplication bugs)
const SECTION_EMOJIS = '💧|🌲|🛠️|🏔️|🏆|⭐|🎯|🔥|✨|📦|🛒|💡|🎬|📚|🍽️|🏠|🚗|💻|📱|🎮|🎵|👕|💄|🧴|🏋️|⚽|🎨|✈️|🐕|👶';

/**
 * Final Response Normalizer
 * Ensures clean visual structure after all enforcement passes
 * This is a FORMATTER, not a filter - it restructures for display
 */
function normalizeAssistantOutput(text: string, queryIntent: string): string {
  // SKIP HEURISTIC: Don't over-format short or conversational responses
  const lineCount = text.split('\n').length;
  const hasEmojis = new RegExp(`(?:${SECTION_EMOJIS})`).test(text);
  
  // Detect structural signals that indicate product/brand sections
  // Brand pattern: 1-4 Title Case words in bold (prevents false positives like "Good Choice")
  const hasBoldBrand = /\*\*[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3}\*\*/.test(text);
  const hasBulletBrand = /[•*]\s*\*\*[A-Z]/.test(text);
  const hasColonBrand = /:\s*\*\s*\*\*[A-Z]/.test(text);
  
  const hasStructuralSignals = hasEmojis || hasBoldBrand || hasBulletBrand || hasColonBrand;
  
  // Skip if: general query, very short, or no structural signals
  if (queryIntent === 'general' || lineCount < 4 || !hasStructuralSignals) {
    return text;
  }
  
  let result = text;
  
  // RULE 0: Extract inline brand headers to their own lines (CRITICAL - runs first)
  // Pattern: punctuation followed by optional bullet + bold brand (1-4 words) + colon
  result = result.replace(
    /([.!?:])\s*(?:[•*]\s*)?\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})\*\*:/g,
    '$1\n\n**$2**\n'
  );
  
  // Also handle: "starting with **Brand**." embedded in paragraphs
  result = result.replace(
    /(starting with|recommend|try|consider|check out)\s*\*\*([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+){0,3})\*\*\.\s*/gi,
    '$1:\n\n**$2**\n\n'
  );
  
  // RULE 1: Remove visual garbage (---, —, horizontal rules)
  result = result.replace(/^-{2,}\s*/gm, ''); // Lines starting with ---
  result = result.replace(/\s*-{2,}\s*/g, '\n\n'); // Inline --- becomes line break
  result = result.replace(/—\s*—\s*—/g, ''); // Em-dash separators
  result = result.replace(/^\s*[-–—]{3,}\s*$/gm, ''); // Full line of dashes
  
  // RULE 2: Force emoji headers onto their own line
  const emojiHeaderPattern = new RegExp(
    `([.!?:,])\\s*((?:${SECTION_EMOJIS})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?)`,
    'g'
  );
  result = result.replace(emojiHeaderPattern, '$1\n\n$2');
  
  // RULE 3: Ensure emoji headers have line break after them
  const emojiLinePattern = new RegExp(
    `((?:${SECTION_EMOJIS})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?)([^\\n])`,
    'g'
  );
  result = result.replace(emojiLinePattern, '$1\n$2');
  
  // RULE 4: Fix inline bullets (bullet embedded in paragraph)
  result = result.replace(/([.!?:,])\s*([•\-–—*]\s*\*?\*?[A-Z])/g, '$1\n\n$2');
  
  // RULE 5: Ensure blank line before each emoji header section
  const sectionHeaderPattern = new RegExp(
    `([^\\n])\\n((?:${SECTION_EMOJIS})\\s*\\*?\\*?[A-Z])`,
    'g'
  );
  result = result.replace(sectionHeaderPattern, '$1\n\n$2');
  
  // RULE 6: Normalize spacing
  result = result.replace(/\n{3,}/g, '\n\n'); // Max 2 line breaks
  
  // RULE 7: Clean up orphaned emojis on their own line
  const orphanEmojiPattern = new RegExp(
    `^\\s*((?:${SECTION_EMOJIS}))\\s*$\\n\\s*(\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?)`,
    'gm'
  );
  result = result.replace(orphanEmojiPattern, '$1 $2');
  
  // RULE 8: Final whitespace cleanup
  result = result.trim();
  result = result.replace(/\s+$/gm, ''); // Trailing spaces on each line
  
  return result;
}

// ========== HELPER FUNCTIONS ==========

/**
 * ARCHITECTURAL INVARIANT - DO NOT MODIFY
 *
 * - NEVER send google_search and function_declarations in the same Gemini request.
 *   This causes 400 INVALID_ARGUMENT errors due to Gemini API constraints.
 * - Tool selection MUST happen before the API call via intent routing (classifyQueryIntent).
 * - Internal tools ADD value; they do NOT gate intelligence.
 * - General knowledge questions MUST be answered even if tools return empty.
 *
 * Trust hierarchy:
 * 1. User constraints (Things to Avoid) - ALWAYS respect
 * 2. Explicit user data (tools: get_user_stuff, search_user_memory)
 * 3. Gemini knowledge (direct answers for general questions)
 * 4. Web grounding (google_search for real-time info)
 * 5. Common Groundz reviews (search_reviews_semantic for product discovery)
 *
 * Breaking these invariants will cause API errors and regression to tool-first logic.
 */

// ============= LLM CLASSIFICATION CACHE =============
// In-memory cache for LLM classification results (per function instance)
// Prevents redundant API calls for repeated queries

interface LLMClassificationCacheEntry {
  category: string;
  confidence: number;
  timestamp: number;
}

const llmClassificationCache = new Map<string, LLMClassificationCacheEntry>();
const LLM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeQueryForCache(query: string): string {
  return query.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

// ============= DISCOVERY TELEMETRY =============

interface DiscoveryTelemetry {
  tier: 'keyword' | 'llm_fallback';
  matchedCategory: string | null;
  llmConfidence: number | null;
  timestamp: number;
}

function logDiscoveryTelemetry(
  tier: 'keyword' | 'llm_fallback',
  matchedCategory: string | null,
  llmConfidence: number | null
): void {
  const telemetry: DiscoveryTelemetry = {
    tier,
    matchedCategory,
    llmConfidence,
    timestamp: Date.now()
  };
  
  console.log('[discovery-telemetry]', JSON.stringify(telemetry));
}

// ============= LLM CLASSIFICATION HELPER =============

/**
 * Classify query using LLM (Tier 2 fallback)
 * Uses existing classify-search-query edge function with caching
 */
async function classifyQueryWithLLM(
  query: string
): Promise<{ category: string; confidence: number } | null> {
  const cacheKey = normalizeQueryForCache(query);
  
  // Check cache first
  const cached = llmClassificationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < LLM_CACHE_TTL_MS) {
    console.log(`[classifyQueryWithLLM] Cache hit: "${cacheKey.substring(0, 40)}..." → ${cached.category}`);
    return { category: cached.category, confidence: cached.confidence };
  }
  
  try {
    // Call existing classify-search-query edge function via direct fetch
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[classifyQueryWithLLM] Missing Supabase config');
      return null;
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/classify-search-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query })
    });
    
    if (!response.ok) {
      console.error('[classifyQueryWithLLM] Classification failed:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Validate against supported categories
    if (!VALID_LLM_CATEGORIES.includes(data.classification)) {
      console.log(`[classifyQueryWithLLM] Unsupported category: ${data.classification}`);
      return null;
    }
    
    // Cache the result
    llmClassificationCache.set(cacheKey, {
      category: data.classification,
      confidence: data.confidence,
      timestamp: Date.now()
    });
    
    console.log(`[classifyQueryWithLLM] LLM classified: "${query.substring(0, 40)}..." → ${data.classification} (${data.confidence})`);
    
    return { category: data.classification, confidence: data.confidence };
  } catch (error) {
    console.error('[classifyQueryWithLLM] Error:', error);
    return null;
  }
}

/**
 * Classify user intent to determine which tools to use.
 * This enables separate API calls to avoid google_search + function_declarations conflict.
 * 
 * HYBRID APPROACH (Phase 2):
 * - Tier 1: Fast keyword matching using discovery-config.ts (0ms)
 * - Tier 2: LLM classification fallback for natural language (~300ms)
 * 
 * NOTE: "general" includes both:
 * 1. Pure general knowledge (facts, explanations) - e.g., "What is BPA?"
 * 2. Context-aware opinions (apply user constraints, no tools) - e.g., "Is Tupperware okay for me?"
 * These MUST NOT trigger function calls or web search by default.
 * 
 * IMPORTANT: "what are" is NOT in the explanatory override because it's often used for
 * product discovery (e.g., "What are the best steel bottles?")
 */
async function classifyQueryIntent(
  message: string, 
  conversationHistory: Array<{role: string; content: string}>
): Promise<'realtime' | 'product_user' | 'general'> {
  const lowerMessage = message.toLowerCase();
  
  // Legacy product categories (kept for backward compatibility with existing checks)
  const productCategories = [
    'bottle', 'bottles', 'container', 'containers', 'tupperware',
    'sunscreen', 'lotion', 'cream', 'moisturizer', 'skincare',
    'laptop', 'phone', 'headphones', 'earbuds', 'tablet',
    'shoes', 'sneakers', 'clothing', 'jacket', 'shirt',
    'cookware', 'pan', 'pot', 'utensils', 'knife',
    'mattress', 'pillow', 'bedding', 'blanket',
    'backpack', 'bag', 'luggage', 'suitcase',
    'watch', 'fitness tracker', 'smartwatch',
    'camera', 'lens', 'tripod',
    'charger', 'cable', 'adapter',
    'speaker', 'monitor', 'keyboard', 'mouse',
    'steel', 'stainless', 'glass', 'ceramic', 'bamboo',
    'drinkware', 'food storage', 'kitchen'
  ];
  
  // PRIORITY 1: Explanatory questions -> general knowledge
  // NOTE: "what are" is intentionally NOT included - it's often used for product discovery
  if (
    lowerMessage.startsWith('why ') ||
    lowerMessage.startsWith('how ') ||
    lowerMessage.startsWith('what is ') ||
    lowerMessage.startsWith('explain ')
  ) {
    console.log('[classifyQueryIntent] Explanatory question detected, using general');
    return 'general';
  }
  
  // PRIORITY 2: Real-time patterns -> realtime (web search)
  // Use REGEX for flexible matching - describes structure, not every word variation
  
  // Regex patterns for purchase/find-online/availability intent (scalable approach)
  const realtimeRegexPatterns = [
    /find\b.*\bonline/i,                    // "find X online", "find them online", "find me any of them online"
    /where\s+(?:can|do|would|could)\s+i\s+(?:buy|get|find|order|shop)/i,  // "where can I buy/get/find"
    /(?:buy|purchase|order|get|shop)\s+.*\bonline/i,  // "buy X online", "shop for X online"
    /available\s+(?:online|on\s+amazon|on\s+ebay|for\s+purchase)/i,  // "available online"
    /(?:show|give|send)\s+(?:me\s+)?(?:a\s+)?links?\b/i,  // "show me links", "give me a link"
    /\bonline\s+(?:store|shop|retailer|seller)/i,  // "online store", "online shop"
    // URL-intent catch-all (Gemini suggestion)
    /(?:link|url|website|where\s+to\s+buy|get\s+it\s+from)/i,  // "link please", "website for this"
  ];

  for (const pattern of realtimeRegexPatterns) {
    if (pattern.test(lowerMessage)) {
      console.log(`[classifyQueryIntent] Matched realtime regex: ${pattern}`);
      return 'realtime';
    }
  }

  // Simple keyword patterns for time-sensitive/research queries
  const realtimeKeywords = [
    'latest', 'recent', 'current', 'today', 'now', 'news',
    'price of', 'cost of', 'happening', 'update on',
    'what is the price', 'how much does', 'trending',
    'this week', 'this month', 'right now', '2024', '2025', '2026',
    'research', 'study', 'paper', 'evidence', 'findings',
    'amazon', 'ebay', 'walmart', 'target', 'flipkart'
  ];

  for (const keyword of realtimeKeywords) {
    if (lowerMessage.includes(keyword)) {
      console.log(`[classifyQueryIntent] Matched realtime keyword: "${keyword}"`);
      return 'realtime';
    }
  }
  
  // PRIORITY 2.7: Context-aware follow-up escalation (ChatGPT suggestion)
  // If previous assistant message discussed products, and user wants to find/get/show them online
  const lastAssistantForRealtime = conversationHistory
    ?.slice()
    ?.reverse()
    ?.find(m => m.role === 'assistant')
    ?.content
    ?.toLowerCase() ?? '';

  const wasProductDiscussion = /bottle|steel|brand|product|option|choice|model|size|recommend|alternative|hydro|stanley|klean|container|tupperware|sunscreen|laptop|phone|headphone/i.test(lastAssistantForRealtime);

  const followupFindOnline = /(?:find|get|show|give)\s+(?:me\s+)?(?:some|any|one|them|these|those|it)/i.test(lowerMessage) 
    && /online|buy|shop|link|available|purchase|order/i.test(lowerMessage);

  if (wasProductDiscussion && followupFindOnline) {
    console.log('[classifyQueryIntent] Contextual find-online follow-up after product discussion → realtime');
    return 'realtime';
  }
  
  // PRIORITY 3: User-specific patterns -> product_user (always)
  const userSpecificPatterns = [
    'my stuff', 'my preferences', 'what do i use', 'what am i using',
    'my history', 'my profile', 'i own', 'i have', 'i bought',
    'save this', 'remember this', 'similar users', 'people like me'
  ];
  
  for (const pattern of userSpecificPatterns) {
    if (lowerMessage.includes(pattern)) {
      console.log(`[classifyQueryIntent] User-specific: "${pattern}"`);
      return 'product_user';
    }
  }
  
  // PRIORITY 4: Explicit platform mention -> product_user
  if (lowerMessage.includes('common groundz') || lowerMessage.includes('on common groundz')) {
    console.log('[classifyQueryIntent] Explicit platform mention');
    return 'product_user';
  }
  
  // PRIORITY 4.5: Follow-up category answer detection
  // If user gives a short answer containing a product category,
  // AND the previous assistant message was asking for product type
  const lastAssistant = [...conversationHistory]
    .reverse()
    .find(m => m.role === 'assistant')?.content?.toLowerCase() ?? '';
  
  const askedForCategory = /what kind of product|product type|are you interested in|which (one|type)|looking for\?|for example|could you tell me/.test(lastAssistant);
  const isShortAnswer = lowerMessage.trim().split(/\s+/).length <= 4;
  const mentionsCategory = productCategories.some(c => lowerMessage.includes(c));
  
  if (askedForCategory && isShortAnswer && mentionsCategory) {
    console.log('[classifyQueryIntent] Follow-up category answer detected');
    return 'product_user';
  }
  
  // PRIORITY 4.55: Conversation-state override (PRIMARY for follow-ups)
  // If previous assistant turn discussed products, and user's follow-up isn't explicitly off-topic,
  // maintain the product_user intent. Users don't repeat "best", "recommend" in follow-ups.
  const wasProductExchange = /hydro flask|klean kanteen|stanley|yeti|brand|bottle|option|choice|recommend|alternative|comparison|container|tupperware|sunscreen|laptop|phone|headphone|product|item/i.test(lastAssistant)
    && lastAssistant.length > 200; // Substantial product response

  // Follow-up indicators: pronouns, demonstratives, comparison/elaboration intent
  const isContextualFollowUp = /(?:these|them|those|which one|which should|the|differences?|between|compare|comparison|help me understand|tell me more|more about|elaborate|explain|should i|buy|pick|choose)/i.test(lowerMessage);

  // Explicit off-topic indicators (user is changing subject)
  const isExplicitlyOffTopic = /(?:^how to|^what is a|^why do|^explain what|^tell me about something|completely different|new topic|another question|unrelated|forget|never mind|different subject)/i.test(lowerMessage);

  if (wasProductExchange && isContextualFollowUp && !isExplicitlyOffTopic) {
    console.log('[classifyQueryIntent] Conversation-state override: continuing product_user flow');
    return 'product_user';
  }

  // PRIORITY 4.56: Explicit comparison/elaboration detection (FALLBACK)
  // Catches cases where conversation-state check doesn't trigger but keywords are present
  const followupCompareOrLearn = /(?:compare|comparison|difference|differences|between|which one|which should|help me understand|understand the|tell me more|more about|elaborate|explain these)/i.test(lowerMessage)
    && /(?:these|them|those|brand|brands|option|options|which|the)/i.test(lowerMessage);

  const wasProductListing = /hydro flask|klean kanteen|stanley|yeti|brand|bottle|option|choice|recommend/i.test(lastAssistant);

  if (wasProductListing && followupCompareOrLearn) {
    console.log('[classifyQueryIntent] Explicit comparison/elaboration follow-up → product_user');
    return 'product_user';
  }
  
  // ============= HYBRID DISCOVERY ROUTING (Phase 2) =============
  
  // PRIORITY 5: Platform Discovery - Tier 1 (Keyword Matching) - 0ms
  const hasDiscoveryVerb = hasRecommendationVerb(message);
  const matchedToken = findMatchedToken(message);
  const matchedSynonym = findMatchedSynonym(message);
  
  if (hasDiscoveryVerb && (matchedToken || matchedSynonym)) {
    const matchedCategory = matchedToken 
      ? getCategoryFromToken(matchedToken) 
      : getCategoryFromSynonym(matchedSynonym!);
    
    logDiscoveryTelemetry('keyword', matchedCategory, null);
    console.log(`[classifyQueryIntent] Tier 1 keyword match: token="${matchedToken}", synonym="${matchedSynonym}", category="${matchedCategory}"`);
    return 'product_user';
  }
  
  // PRIORITY 5.5: Recommendation + Location Override
  // If user has discovery verb + location marker, route to product_user
  const hasLocationMarker = /\b(in|around|near|at|for)\s+[A-Z][a-z]+/i.test(message);
  if (hasDiscoveryVerb && hasLocationMarker) {
    logDiscoveryTelemetry('keyword', 'location_override', null);
    console.log('[classifyQueryIntent] Recommendation + location detected');
    return 'product_user';
  }
  
  // PRIORITY 6: Platform Discovery - Tier 2 (LLM Classification) - ~300ms
  // Only trigger if: likely discovery query AND no keyword match
  if (isLikelyDiscoveryQuery(message)) {
    console.log('[classifyQueryIntent] No keyword match, trying LLM classification...');
    
    const llmResult = await classifyQueryWithLLM(message);
    
    if (llmResult && llmResult.confidence > 0.7) {
      logDiscoveryTelemetry('llm_fallback', llmResult.category, llmResult.confidence);
      console.log(`[classifyQueryIntent] Tier 2 LLM match: category="${llmResult.category}", confidence=${llmResult.confidence}`);
      return 'product_user';
    }
  }
  
  // PRIORITY 7 (Legacy): Product discovery with concrete categories
  // Kept for backward compatibility with existing product tokens
  const discoveryKeywords = ['best', 'top', 'recommend', 'reviews', 'alternatives', 'should i buy', 'which should', 'which one', 'help me choose'];
  
  const hasLegacyDiscoveryIntent = discoveryKeywords.some(k => lowerMessage.includes(k));
  const hasLegacyProductCategory = productCategories.some(c => lowerMessage.includes(c));
  
  if (hasLegacyDiscoveryIntent && hasLegacyProductCategory) {
    console.log('[classifyQueryIntent] Legacy product discovery (intent + category match)');
    return 'product_user';
  }
  
  // Default: general knowledge
  // Log unmatched queries for debugging and pattern improvement
  console.log(`[classifyQueryIntent] Unmatched query, defaulting to general: "${lowerMessage.substring(0, 80)}..."`);
  return 'general';
}

/**
 * Timeout wrapper to prevent hanging requests
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Fetch with exponential backoff retry logic for 503 and 429 errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wrap fetch in timeout (8 seconds)
      const response = await withTimeout(fetch(url, options), 8000);
      
      // If 503 (Service Unavailable) or 429 (Rate Limit), retry with backoff
      if (response.status === 503 || response.status === 429) {
        if (attempt < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`[fetchWithRetry] Received ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] ${isTimeout ? 'Timeout' : 'Network error'}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  // User-friendly fallback message
  throw new Error("I'm having trouble reaching the AI service right now. Please try again in 10–15 seconds.");
}

// ========== NEW PHASE 6 TOOL FUNCTIONS ==========

async function getUserStuff(
  supabaseClient: any,
  userId: string,
  category?: string,
  status?: string,
  limit: number = 20
): Promise<any> {
  try {
    console.log('[getUserStuff] UserId:', userId, 'Category:', category, 'Status:', status, 'Limit:', limit);

    let query = supabaseClient
      .from('user_stuff')
      .select(`
        id,
        entity_id,
        status,
        sentiment_score,
        category,
        started_using_at,
        stopped_using_at,
        entity:entity_id(id, name, type, slug, image_url)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getUserStuff] Error:', error);
      throw error;
    }

    // Format as compact inventory for system prompt
    const compactInventory = data?.reduce((acc: any, item: any) => {
      const cat = item.category || item.entity?.type || 'other';
      if (!acc[cat]) acc[cat] = [];
      const sentiment = item.sentiment_score !== null ? ` (${item.sentiment_score > 0 ? '+' : ''}${item.sentiment_score})` : '';
      acc[cat].push({
        name: item.entity?.name || 'Unknown',
        status: item.status,
        sentiment: item.sentiment_score,
        displayText: `${item.entity?.name}${sentiment}`
      });
      return acc;
    }, {});

    return {
      success: true,
      items: data || [],
      compact_inventory: compactInventory,
      total_count: data?.length || 0
    };

  } catch (error) {
    console.error('[getUserStuff] Error:', error);
    return {
      success: false,
      error: error.message,
      items: []
    };
  }
}

async function getPersonalizedTransitions(
  supabaseClient: any,
  userId: string,
  entityId?: string,
  transitionType?: string,
  limit: number = 5
): Promise<any> {
  try {
    console.log('[getPersonalizedTransitions] UserId:', userId, 'EntityId:', entityId, 'Type:', transitionType, 'Limit:', limit);

    // Call the get-personalized-transitions edge function
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/get-personalized-transitions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        userId,
        entityId,
        transitionType,
        limit
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[getPersonalizedTransitions] Error:', errorText);
      throw new Error('Failed to get personalized transitions');
    }

    const data = await response.json();

    return {
      success: true,
      recommendations: data.recommendations || [],
      metadata: data.metadata,
      total_count: data.recommendations?.length || 0
    };

  } catch (error) {
    console.error('[getPersonalizedTransitions] Error:', error);
    return {
      success: false,
      error: error.message,
      recommendations: []
    };
  }
}

async function saveInsightFromChat(
  supabaseClient: any,
  userId: string,
  insightType: string,
  entityFromId: string,
  entityToId: string,
  insightData: any
): Promise<any> {
  try {
    console.log('[saveInsightFromChat] UserId:', userId, 'Type:', insightType, 'From:', entityFromId, 'To:', entityToId);

    const { data, error } = await supabaseClient
      .from('saved_insights')
      .insert({
        user_id: userId,
        insight_type: insightType,
        entity_from_id: entityFromId,
        entity_to_id: entityToId,
        insight_data: insightData
      })
      .select()
      .single();

    if (error) {
      console.error('[saveInsightFromChat] Error:', error);
      throw error;
    }

    return {
      success: true,
      message: 'Insight saved successfully! You can find it in your Saved Insights.',
      saved_insight_id: data.id
    };

  } catch (error) {
    console.error('[saveInsightFromChat] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ========== TOOL EXECUTION FUNCTIONS ==========

// Category mapping for fallback search
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'food': ['restaurant', 'food', 'eat', 'dining', 'cuisine', 'meal', 'dessert', 'cafe', 'coffee', 'breakfast', 'lunch', 'dinner', 'snack', 'burger', 'pizza', 'ice cream', 'biryani', 'dosa', 'idli', 'vegetarian', 'vegan', 'non-veg'],
  'place': ['place', 'visit', 'travel', 'destination', 'attraction', 'park', 'garden', 'museum', 'temple', 'bangalore', 'mumbai', 'delhi', 'chennai', 'hyderabad'],
  'product': ['product', 'protein', 'powder', 'supplement', 'vitamin', 'bottle', 'container', 'gadget', 'device', 'appliance'],
  'movie': ['movie', 'film', 'watch', 'cinema', 'show', 'series', 'documentary'],
  'book': ['book', 'read', 'novel', 'author', 'fiction', 'non-fiction', 'biography']
};

function detectCategoryFromQuery(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const detectedCategories: string[] = [];
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      detectedCategories.push(category);
    }
  }
  
  return detectedCategories;
}

async function searchReviewsSemantic(
  supabaseClient: any,
  query: string,
  entityId?: string,
  limit: number = 5
): Promise<any> {
  try {
    console.log('[searchReviewsSemantic] Query:', query, 'EntityId:', entityId, 'Limit:', limit);
    
    let semanticResults: any[] = [];
    let searchSource = 'semantic';
    
    // Step 1: Try semantic search first (if embeddings exist)
    try {
      const embeddingResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ 
          texts: [{ 
            id: 'search_query', 
            content: query, 
            type: 'review' 
          }] 
        })
      });

      if (embeddingResponse.ok) {
        const { embeddings } = await embeddingResponse.json();
        if (embeddings && embeddings[0]?.embedding) {
          const embedding = embeddings[0].embedding;

          const { data, error } = await supabaseClient.rpc('match_reviews', {
            query_embedding: embedding,
            match_threshold: 0.5,  // Lowered from 0.7 for better recall
            match_count: limit,
            filter_entity_id: entityId || null
          });

          if (!error && data && data.length > 0) {
            semanticResults = data;
            console.log(`[searchReviewsSemantic] Semantic search found ${data.length} results`);
          } else {
            console.log('[searchReviewsSemantic] Semantic search returned no results');
          }
        }
      }
    } catch (embeddingError) {
      console.warn('[searchReviewsSemantic] Semantic search failed, trying fallbacks:', embeddingError);
    }

    // Step 2: If semantic search returned nothing, try text-based fallback
    if (semanticResults.length === 0) {
      console.log('[searchReviewsSemantic] Trying text-based fallback search');
      searchSource = 'text_fallback';
      
      // Extract key search terms from query
      const searchTerms = query.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(term => term.length > 2 && !['the', 'and', 'for', 'what', 'are', 'good', 'best', 'recommend', 'can', 'you', 'please', 'looking'].includes(term));
      
      console.log('[searchReviewsSemantic] Search terms:', searchTerms);

      if (searchTerms.length > 0) {
        // Build OR query for text search
        const searchPattern = searchTerms.slice(0, 3).map(term => `%${term}%`);
        
        let textQuery = supabaseClient
          .from('reviews')
          .select(`
            id, title, description, rating, category, venue, user_id, entity_id, created_at,
            entities!inner(id, name, type, slug, description, venue)
          `)
          .limit(limit * 2);  // Fetch more to allow filtering

        // Search in title, description, venue, or entity name
        const orConditions = searchPattern.flatMap(pattern => [
          `title.ilike.${pattern}`,
          `description.ilike.${pattern}`,
          `venue.ilike.${pattern}`,
          `entities.name.ilike.${pattern}`
        ]).join(',');

        textQuery = textQuery.or(orConditions);

        const { data: textResults, error: textError } = await textQuery;

        if (!textError && textResults && textResults.length > 0) {
          console.log(`[searchReviewsSemantic] Text fallback found ${textResults.length} results`);
          semanticResults = textResults.map((r: any) => ({
            ...r,
            similarity: 0.6  // Assign moderate similarity for text matches
          }));
        }
      }
    }

    // Step 3: If still nothing, try category-based fallback
    if (semanticResults.length === 0) {
      console.log('[searchReviewsSemantic] Trying category-based fallback');
      searchSource = 'category_fallback';
      
      const detectedCategories = detectCategoryFromQuery(query);
      console.log('[searchReviewsSemantic] Detected categories:', detectedCategories);

      if (detectedCategories.length > 0) {
        const { data: categoryResults, error: categoryError } = await supabaseClient
          .from('reviews')
          .select(`
            id, title, description, rating, category, venue, user_id, entity_id, created_at,
            entities!inner(id, name, type, slug, description, venue)
          `)
          .in('category', detectedCategories)
          .order('rating', { ascending: false })
          .limit(limit);

        if (!categoryError && categoryResults && categoryResults.length > 0) {
          console.log(`[searchReviewsSemantic] Category fallback found ${categoryResults.length} results`);
          semanticResults = categoryResults.map((r: any) => ({
            ...r,
            similarity: 0.5  // Assign lower similarity for category matches
          }));
        }
      }
    }

    // Enrich results with entity and user information
    if (semanticResults.length > 0) {
      const enrichedData = await Promise.all(
        semanticResults.slice(0, limit).map(async (review: any) => {
          // Entity might already be joined from text/category search
          let entity = review.entities || review.entity;
          if (!entity && review.entity_id) {
            const { data: entityData } = await supabaseClient
              .from('entities')
              .select('id, name, type, slug')
              .eq('id', review.entity_id)
              .single();
            entity = entityData;
          }

          const { data: user } = await supabaseClient
            .from('profiles')
            .select('id, username, first_name, last_name')
            .eq('id', review.user_id)
            .single();

          return {
            ...review,
            entity,
            user,
            relevance_score: review.similarity || 0.5,
            search_source: searchSource
          };
        })
      );

      return {
        success: true,
        results: enrichedData,
        count: enrichedData.length,
        searchSource
      };
    }

    return {
      success: true,
      results: [],
      count: 0,
      searchSource: 'none',
      message: 'No relevant reviews found for this query.'
    };

  } catch (error) {
    console.error('[searchReviewsSemantic] Error:', error);
    return {
      success: false,
      error: error.message,
      results: [],
      searchSource: 'error'
    };
  }
}

async function findSimilarUsers(
  supabaseClient: any,
  userId: string,
  limit: number = 3
): Promise<any> {
  try {
    console.log('[findSimilarUsers] UserId:', userId, 'Limit:', limit);

    // Get the user's profile embedding
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('profile_embedding')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile?.profile_embedding) {
      return {
        success: false,
        error: 'User profile embedding not found. User may need to create more content.',
        results: []
      };
    }

    // Use match_profiles RPC for vector similarity search
    const { data, error } = await supabaseClient.rpc('match_profiles', {
      query_embedding: userProfile.profile_embedding,
      match_threshold: 0.75,
      match_count: limit,
      exclude_user_id: userId
    });

    if (error) {
      console.error('[findSimilarUsers] Error:', error);
      throw error;
    }

    // Enrich with follow status and shared interests
    if (data && data.length > 0) {
      const enrichedData = await Promise.all(
        data.map(async (profile: any) => {
          // Check if current user follows this profile
          const { data: followData } = await supabaseClient
            .from('user_follows')
            .select('id')
            .eq('follower_id', userId)
            .eq('following_id', profile.id)
            .maybeSingle();

          // Get shared entity interests
          const { data: currentUserReviews } = await supabaseClient
            .from('reviews')
            .select('entity_id')
            .eq('user_id', userId)
            .limit(100);

          const currentUserEntityIds = currentUserReviews?.map((r: any) => r.entity_id) || [];

          const { data: sharedInterests } = await supabaseClient
            .from('reviews')
            .select('entity_id')
            .eq('user_id', profile.id)
            .in('entity_id', currentUserEntityIds)
            .limit(5);

          return {
            ...profile,
            is_following: !!followData,
            shared_interests_count: sharedInterests?.length || 0,
            similarity_score: profile.similarity
          };
        })
      );

      return {
        success: true,
        results: enrichedData,
        count: enrichedData.length
      };
    }

    return {
      success: true,
      results: [],
      count: 0,
      message: 'No similar users found.'
    };

  } catch (error) {
    console.error('[findSimilarUsers] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
}

async function getProductRelationships(
  supabaseClient: any,
  entityId: string,
  relationshipType?: string
): Promise<any> {
  try {
    console.log('[getProductRelationships] EntityId:', entityId, 'Type:', relationshipType);

    // Build query for product_relationships table
    let query = supabaseClient
      .from('product_relationships')
      .select(`
        id,
        relationship_type,
        confidence_score,
        extracted_context,
        verified_by_admin,
        source:source_entity_id(id, name, type, slug, image_url),
        target:target_entity_id(id, name, type, slug, image_url)
      `)
      .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
      .order('confidence_score', { ascending: false });

    if (relationshipType) {
      query = query.eq('relationship_type', relationshipType);
    }

    const { data, error } = await query.limit(10);

    if (error) {
      console.error('[getProductRelationships] Error:', error);
      throw error;
    }

    if (data && data.length > 0) {
      // Organize by relationship type
      const organized = data.reduce((acc: any, rel: any) => {
        const type = rel.relationship_type;
        if (!acc[type]) acc[type] = [];
        
        // Determine which entity is the "related" one
        const relatedEntity = rel.source.id === entityId ? rel.target : rel.source;
        
        acc[type].push({
          entity: relatedEntity,
          confidence: rel.confidence_score,
          context: rel.extracted_context,
          verified: rel.verified_by_admin
        });
        
        return acc;
      }, {});

      return {
        success: true,
        relationships: organized,
        total_count: data.length
      };
    }

    return {
      success: true,
      relationships: {},
      total_count: 0,
      message: 'No product relationships found yet. Relationships are discovered from user reviews.'
    };

  } catch (error) {
    console.error('[getProductRelationships] Error:', error);
    return {
      success: false,
      error: error.message,
      relationships: {}
    };
  }
}

async function getUserContext(
  supabaseClient: any,
  userId: string,
  contextType: 'preferences' | 'history' | 'goals' | 'interests',
  entityType?: string
): Promise<any> {
  try {
    console.log('[getUserContext] UserId:', userId, 'Type:', contextType, 'EntityType:', entityType);

    switch (contextType) {
      case 'preferences': {
        // Get user's preferences from profile and memories
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('bio, preferences')
          .eq('id', userId)
          .single();

        const { data: memories } = await supabaseClient
          .from('user_conversation_memory')
          .select('memory_summary, context_data')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(5);

        return {
          success: true,
          data: {
            bio: profile?.bio,
            preferences: profile?.preferences,
            learned_preferences: memories?.map((m: any) => ({
              summary: m.memory_summary,
              data: m.context_data
            }))
          }
        };
      }

      case 'history': {
        // Get user's review and interaction history
        let query = supabaseClient
          .from('reviews')
          .select(`
            id,
            title,
            rating,
            is_recommended,
            created_at,
            entity:entity_id(id, name, type, slug)
          `)
          .eq('user_id', userId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20);

        if (entityType) {
          // Need to filter after join - Supabase limitation
          const { data: allReviews } = await query;
          const filtered = allReviews?.filter((r: any) => r.entity?.type === entityType);
          
          const { data: savedEntities } = await supabaseClient
            .from('saved_entities')
            .select('entity:entity_id(id, name, type, slug)')
            .eq('user_id', userId)
            .limit(10);

          return {
            success: true,
            data: {
              reviews: filtered || [],
              saved_entities: savedEntities || [],
              total_reviews: filtered?.length || 0
            }
          };
        }

        const { data: reviews } = await query;

        // Get saved/liked entities
        const { data: savedEntities } = await supabaseClient
          .from('saved_entities')
          .select('entity:entity_id(id, name, type, slug)')
          .eq('user_id', userId)
          .limit(10);

        return {
          success: true,
          data: {
            reviews: reviews || [],
            saved_entities: savedEntities || [],
            total_reviews: reviews?.length || 0
          }
        };
      }

      case 'goals': {
        // Get user's stated goals from memories and preferences
        const { data: memories } = await supabaseClient
          .from('user_conversation_memory')
          .select('memory_summary, context_data')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(10);

        // Extract goal-related information
        const goalRelatedMemories = memories?.filter((m: any) => 
          m.memory_summary.toLowerCase().includes('want') ||
          m.memory_summary.toLowerCase().includes('looking for') ||
          m.memory_summary.toLowerCase().includes('goal') ||
          m.context_data?.goals
        );

        return {
          success: true,
          data: {
            goals: goalRelatedMemories?.map((m: any) => ({
              summary: m.memory_summary,
              details: m.context_data?.goals
            })) || [],
            message: goalRelatedMemories?.length === 0 
              ? 'No specific goals identified yet. Continue chatting to help me learn your preferences!'
              : undefined
          }
        };
      }

      case 'interests': {
        // Similar to preferences but focused on entity-level interests
        const { data: reviews } = await supabaseClient
          .from('reviews')
          .select(`
            rating,
            is_recommended,
            entity:entity_id(id, name, type)
          `)
          .eq('user_id', userId)
          .eq('status', 'published')
          .gte('rating', 4)
          .order('created_at', { ascending: false })
          .limit(30);

        // Group by entity type
        const interestsByType = reviews?.reduce((acc: any, review: any) => {
          const type = review.entity?.type || 'other';
          if (!acc[type]) acc[type] = [];
          acc[type].push(review.entity);
          return acc;
        }, {});

        return {
          success: true,
          data: {
            interests_by_type: interestsByType || {},
            high_rated_count: reviews?.length || 0
          }
        };
      }

      default:
        return {
          success: false,
          error: 'Invalid context type'
        };
    }

  } catch (error) {
    console.error('[getUserContext] Error:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

async function webSearch(query: string): Promise<any> {
  try {
    console.log('[webSearch] Query:', query);

    // Web search is now handled via intent router -> google_search grounding
    // This function is kept for backward compatibility
    return {
      success: true,
      message: `Web search for "${query}" is handled by google_search grounding via intent router.`,
      results: [],
      note: 'Use queries with real-time keywords (latest, news, current, research) to trigger web search'
    };

  } catch (error) {
    console.error('[webSearch] Error:', error);
    return {
      success: false,
      error: error.message,
      results: [],
      fallback_message: 'Answer from your knowledge instead.'
    };
  }
}

async function searchUserMemory(
  supabaseClient: any,
  userId: string,
  query: string,
  scope?: string
): Promise<any> {
  try {
    console.log('[searchUserMemory] Query:', query, 'Scope:', scope, 'User:', userId);
    
    const { data: userMemory } = await supabaseClient
      .from('user_conversation_memory')
      .select('memory_summary, metadata')
      .eq('user_id', userId)
      .single();
    
    if (!userMemory) {
      return {
        success: false,
        message: 'No memory found for this user yet.'
      };
    }
    
    const scopes = userMemory.metadata?.scopes || {};
    
    // Filter by scope if specified
    if (scope && scope !== 'all') {
      return {
        success: true,
        scope: scope,
        data: scopes[scope] || {},
        summary: userMemory.memory_summary
      };
    }
    
    // Return all scopes
    return {
      success: true,
      data: scopes,
      summary: userMemory.memory_summary
    };
    
  } catch (error) {
    console.error('[searchUserMemory] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============= PHASE 1: OUTCOME SIGNAL FUNCTIONS =============

/**
 * Get rating trajectory from review updates
 * Pure function - deterministic, cacheable
 */
async function getRatingTrajectory(
  supabaseClient: any,
  reviewId: string
): Promise<'improving' | 'declining' | 'stable'> {
  try {
    const { data: updates } = await supabaseClient
      .from('review_updates')
      .select('rating')
      .eq('review_id', reviewId)
      .order('created_at', { ascending: true });
    
    if (!updates || updates.length < 2) return 'stable';
    
    // Filter out null ratings
    const validRatings = updates.filter((u: any) => u.rating !== null);
    if (validRatings.length < 2) return 'stable';
    
    const firstRating = validRatings[0].rating;
    const lastRating = validRatings[validRatings.length - 1].rating;
    
    if (lastRating > firstRating) return 'improving';
    if (lastRating < firstRating) return 'declining';
    return 'stable';
  } catch (error) {
    console.error('[getRatingTrajectory] Error:', error);
    return 'stable';
  }
}

/**
 * Extract outcome signals for a user's interaction with an entity
 * 
 * CRITICAL: This function MUST be:
 * - Deterministic (same input → same output)
 * - Side-effect free (no writes, no external calls)
 * - Cacheable by (userId, entityId)
 * 
 * ChatGPT Refinement #3: Pure & Cacheable
 */
async function extractOutcomeSignals(
  supabaseClient: any,
  userId: string,
  entityId: string,
  category?: string
): Promise<OutcomeSignals | null> {
  try {
    // 1. Query user_stuff for this user+entity
    const { data: userStuff } = await supabaseClient
      .from('user_stuff')
      .select('status, started_using_at, stopped_using_at, entity_id, entity_type')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .maybeSingle();
    
    if (!userStuff) return null;
    
    // 2. Calculate usage duration
    const startDate = userStuff.started_using_at ? new Date(userStuff.started_using_at) : null;
    const endDate = userStuff.stopped_using_at ? new Date(userStuff.stopped_using_at) : new Date();
    const usageDurationMonths = startDate 
      ? Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;
    
    // 3. Determine usage status
    const stillUsing = userStuff.status === 'currently_using';
    const stoppedUsing = userStuff.status === 'stopped_using' || !!userStuff.stopped_using_at;
    
    // 4. Query reviews for timeline data
    const { data: review } = await supabaseClient
      .from('reviews')
      .select('id, rating, latest_rating, has_timeline, timeline_count')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .maybeSingle();
    
    const hasTimeline = review?.has_timeline || false;
    const timelineUpdates = review?.timeline_count || 0;
    const latestRating = review?.latest_rating || review?.rating || 0;
    
    // 5. Get rating trajectory
    const ratingTrajectory = review?.id 
      ? await getRatingTrajectory(supabaseClient, review.id)
      : 'stable';
    
    // 6. Calculate signal strength (DETERMINISTIC formula)
    const weights = OUTCOME_SCORING_CONFIG.weights;
    let rawSignalStrength = 0;
    
    // Usage duration contribution (capped at 12 months)
    const cappedDuration = Math.min(usageDurationMonths, weights.maxUsageDurationMonths);
    rawSignalStrength += cappedDuration * weights.usageDurationPerMonth;
    
    // Usage status contribution
    rawSignalStrength += stillUsing ? weights.stillUsing : 0;
    rawSignalStrength += stoppedUsing ? weights.stoppedUsing : 0;
    
    // Timeline contribution
    rawSignalStrength += hasTimeline ? weights.hasTimeline : 0;
    
    // Rating trajectory contribution
    rawSignalStrength += ratingTrajectory === 'improving' ? weights.ratingImproving :
                         ratingTrajectory === 'declining' ? weights.ratingDeclining :
                         weights.ratingStable;
    
    // CAP at maxContributionPerUser (ChatGPT Refinement #1)
    const signalStrength = Math.min(
      Math.max(rawSignalStrength, -0.40),  // Floor at -0.40
      OUTCOME_SCORING_CONFIG.maxContributionPerUser
    );
    
    console.log(`[extractOutcomeSignals] User ${userId.substring(0, 8)}... Entity ${entityId.substring(0, 8)}... Signal: ${signalStrength.toFixed(3)}`);
    
    return {
      usageDurationMonths,
      stillUsing,
      stoppedUsing,
      hasTimeline,
      timelineUpdates,
      ratingTrajectory,
      latestRating,
      signalStrength
    };
  } catch (error) {
    console.error('[extractOutcomeSignals] Error:', error);
    return null;
  }
}

/**
 * Get candidate products from similar users with outcome signals
 * 
 * My Addition #1: Filter to active users (within 90 days)
 * My Addition #2: Category-aware filtering
 */
async function getSimilarUserCandidates(
  supabaseClient: any,
  similarUserIds: string[],
  category?: string,
  activeWithinDays: number = 90
): Promise<CandidateProduct[]> {
  if (!similarUserIds.length) return [];
  
  try {
    console.log(`[getSimilarUserCandidates] Processing ${similarUserIds.length} similar users, category: ${category || 'all'}`);
    
    // 1. Query user_stuff for similar users' items
    let query = supabaseClient
      .from('user_stuff')
      .select(`
        entity_id,
        user_id,
        status,
        updated_at,
        entity_type,
        entities!inner(id, name, type)
      `)
      .in('user_id', similarUserIds)
      .in('status', ['currently_using', 'stopped_using']);
    
    // My Addition #2: Category-aware filtering
    if (category) {
      // Map category to entity types
      const categoryToTypes: Record<string, string[]> = {
        skincare: ['product', 'skincare'],
        haircare: ['product', 'haircare'],
        food: ['food', 'restaurant', 'product'],
        electronics: ['product', 'electronics'],
        fitness: ['product', 'fitness']
      };
      const types = categoryToTypes[category] || ['product'];
      query = query.in('entities.type', types);
    }
    
    const { data: stuffItems, error } = await query;
    
    if (error) {
      console.error('[getSimilarUserCandidates] Query error:', error);
      return [];
    }
    
    if (!stuffItems?.length) {
      console.log('[getSimilarUserCandidates] No stuff items found');
      return [];
    }
    
    // My Addition #1: Filter to active users (updated within N days)
    const activeThreshold = new Date();
    activeThreshold.setDate(activeThreshold.getDate() - activeWithinDays);
    const activeItems = stuffItems.filter((item: any) => {
      const updatedAt = new Date(item.updated_at);
      return updatedAt >= activeThreshold;
    });
    
    console.log(`[getSimilarUserCandidates] Found ${stuffItems.length} items, ${activeItems.length} from active users`);
    
    // 2. Group by entity and extract signals
    const entityMap = new Map<string, CandidateProduct>();
    
    for (const item of activeItems) {
      const entityId = item.entity_id;
      const entityName = item.entities?.name || 'Unknown';
      const entityType = item.entities?.type || 'product';
      
      // Get outcome signals for this user+entity
      const signals = await extractOutcomeSignals(
        supabaseClient,
        item.user_id,
        entityId,
        category
      );
      
      if (!signals) continue;
      
      // Get or create candidate
      let candidate = entityMap.get(entityId);
      if (!candidate) {
        candidate = {
          entityId,
          entityName,
          category: entityType,
          recommendedByUsers: [],
          aggregatedSignals: {
            totalUsers: 0,
            avgSignalStrength: 0,
            avgLatestRating: 0,
            stillUsingCount: 0,
            stoppedUsingCount: 0,
            hasTimelineCount: 0,
            distinctUsersWithSignals: 0
          }
        };
        entityMap.set(entityId, candidate);
      }
      
      // Add user's signals (capped contribution)
      candidate.recommendedByUsers.push({
        userId: item.user_id,
        signals,
        cappedContribution: signals.signalStrength
      });
    }
    
    // 3. Aggregate signals for each candidate
    for (const candidate of entityMap.values()) {
      const users = candidate.recommendedByUsers;
      const totalSignalStrength = users.reduce((sum, u) => sum + u.signals.signalStrength, 0);
      const totalRating = users.reduce((sum, u) => sum + u.signals.latestRating, 0);
      
      candidate.aggregatedSignals = {
        totalUsers: users.length,
        avgSignalStrength: users.length > 0 ? totalSignalStrength / users.length : 0,
        avgLatestRating: users.length > 0 ? totalRating / users.length : 0,
        stillUsingCount: users.filter(u => u.signals.stillUsing).length,
        stoppedUsingCount: users.filter(u => u.signals.stoppedUsing).length,
        hasTimelineCount: users.filter(u => u.signals.hasTimeline).length,
        distinctUsersWithSignals: users.filter(u => u.signals.signalStrength !== 0).length
      };
    }
    
    const candidates = Array.from(entityMap.values());
    console.log(`[getSimilarUserCandidates] Generated ${candidates.length} candidate products`);
    
    return candidates;
  } catch (error) {
    console.error('[getSimilarUserCandidates] Error:', error);
    return [];
  }
}

/**
 * Apply scoring to a candidate product based on outcome signals
 * 
 * ChatGPT Add #1: Skip scoring if < 2 users have signals
 * ChatGPT Add #2: Cap total similar-user score at 0.6
 * ChatGPT Add #3: Negative override when stopped >= stillUsing && stopped >= 2
 */
function applySimilarUserScore(
  candidate: CandidateProduct,
  config: typeof OUTCOME_SCORING_CONFIG
): {
  score: number;
  breakdown: Record<string, number>;
  skipScoring: boolean;
  negativeOverrideApplied: boolean;
} {
  const agg = candidate.aggregatedSignals;
  
  // ChatGPT Add #1: Skip scoring if < 2 users have signals
  if (agg.distinctUsersWithSignals < config.minDistinctUsersForScoring) {
    console.log(`[applySimilarUserScore] Skipping ${candidate.entityName} - only ${agg.distinctUsersWithSignals} users with signals`);
    return {
      score: 0,
      breakdown: { skipped: 1, reason: 'insufficient_users' },
      skipScoring: true,
      negativeOverrideApplied: false
    };
  }
  
  // ChatGPT Add #3: Check for negative signal dominance
  const negativeOverrideApplied = 
    config.negativeOverride.triggerWhenStoppedGteStillUsing &&
    agg.stoppedUsingCount >= agg.stillUsingCount &&
    agg.stoppedUsingCount >= config.negativeOverride.minStoppedCount;
  
  if (negativeOverrideApplied) {
    console.log(`[applySimilarUserScore] Negative override for ${candidate.entityName} - ${agg.stoppedUsingCount} stopped vs ${agg.stillUsingCount} still using`);
    return {
      score: config.negativeOverride.penalty,
      breakdown: {
        negativeOverride: config.negativeOverride.penalty,
        stoppedUsingCount: agg.stoppedUsingCount,
        stillUsingCount: agg.stillUsingCount
      },
      skipScoring: false,
      negativeOverrideApplied: true
    };
  }
  
  // Normal scoring
  const scoring = config.scoring;
  let score = scoring.base;
  const breakdown: Record<string, number> = { base: scoring.base };
  
  // Signal strength contribution
  const signalScore = agg.avgSignalStrength * scoring.signalStrengthMultiplier;
  score += signalScore;
  breakdown.signalStrength = signalScore;
  
  // Still using bonus
  const stillUsingScore = agg.stillUsingCount * scoring.stillUsingPerUser;
  score += stillUsingScore;
  breakdown.stillUsing = stillUsingScore;
  
  // Timeline bonus
  const timelineScore = agg.hasTimelineCount * scoring.timelinePerUser;
  score += timelineScore;
  breakdown.timeline = timelineScore;
  
  // Stopped using penalty
  const stoppedPenalty = agg.stoppedUsingCount * scoring.stoppedUsingPerUser;
  score += stoppedPenalty;
  breakdown.stoppedUsing = stoppedPenalty;
  
  // ChatGPT Add #2: Cap total similar-user contribution
  const cappedScore = Math.min(Math.max(score, -0.40), config.maxSimilarUserScorePerProduct);
  if (cappedScore !== score) {
    breakdown.cappedFrom = score;
    breakdown.cappedTo = cappedScore;
  }
  
  console.log(`[applySimilarUserScore] ${candidate.entityName}: score=${cappedScore.toFixed(3)}, users=${agg.totalUsers}, stillUsing=${agg.stillUsingCount}`);
  
  return {
    score: cappedScore,
    breakdown,
    skipScoring: false,
    negativeOverrideApplied: false
  };
}

/**
 * Calculate average usage duration from users
 */
function calculateAvgUsageDuration(users: CandidateProduct['recommendedByUsers']): number {
  if (users.length === 0) return 0;
  const total = users.reduce((sum, u) => sum + u.signals.usageDurationMonths, 0);
  return Math.round(total / users.length);
}

// ============= PHASE 2: DETERMINISTIC SCORING FUNCTIONS =============

/**
 * Score platform review with recency decay (Phase 2)
 */
function scorePlatformReview(
  review: { rating: number; relevance_score?: number; created_at?: string },
  config: typeof UNIFIED_SCORING_CONFIG.platformReview
): { score: number; breakdown: { base: number; rating: number; relevance: number; recency: number } } {
  const breakdown = {
    base: config.baseWeight,
    rating: 0,
    relevance: 0,
    recency: 0
  };
  
  // Rating contribution (per star above 3)
  const starsAbove3 = Math.max(0, (review.rating || 3) - 3);
  breakdown.rating = starsAbove3 * config.ratingMultiplier;
  
  // Relevance contribution (from semantic search)
  breakdown.relevance = (review.relevance_score || 0.5) * config.relevanceMultiplier;
  
  // Recency adjustment
  if (config.recencyDecay.enabled && review.created_at) {
    const reviewDate = new Date(review.created_at);
    const monthsOld = (Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsOld < config.recencyDecay.freshThresholdMonths) {
      // Fresh review bonus
      breakdown.recency = config.recencyDecay.freshBonus;
    } else {
      // Decay for older reviews
      const decay = Math.min(
        monthsOld * config.recencyDecay.decayPerMonth,
        config.recencyDecay.maxDecay
      );
      breakdown.recency = -decay;
    }
  }
  
  // Calculate total, capped
  let total = breakdown.base + breakdown.rating + breakdown.relevance + breakdown.recency;
  total = Math.min(total, config.maxContributionPerReview);
  
  return { score: total, breakdown };
}

/**
 * Score user history (Phase 2 NEW)
 * 
 * ChatGPT Guardrail #3: Returns rejection with priority for single-rejection logic
 */
function scoreUserHistory(
  productName: string,
  productBrand: string | null,
  userContext: {
    currentProducts: string[];
    stoppedProducts?: string[];
    lovedBrands?: string[];
    activeCategories?: string[];
  },
  category: string | undefined,
  config: typeof UNIFIED_SCORING_CONFIG.userHistory
): { 
  score: number; 
  shouldReject: boolean; 
  rejectionType?: string;
  rejectionPriority?: number;
  reason?: string;
  breakdown: { alreadyOwns: number; previouslyUsed: number; brandLoyalty: number; categoryFamiliarity: number }
} {
  const breakdown = {
    alreadyOwns: 0,
    previouslyUsed: 0,
    brandLoyalty: 0,
    categoryFamiliarity: 0
  };
  
  let shouldReject = false;
  let rejectionType: string | undefined;
  let rejectionPriority: number | undefined;
  let reason: string | undefined;
  
  const normalizedProduct = productName.toLowerCase();
  
  // Check if already owns
  if (userContext.currentProducts.some(p => p.toLowerCase() === normalizedProduct)) {
    breakdown.alreadyOwns = config.currentlyOwns.penalty;
    shouldReject = true;
    rejectionType = config.currentlyOwns.rejectionType;
    rejectionPriority = REJECTION_PRIORITY[rejectionType];
    reason = 'Already in your collection';
  }
  
  // Check if previously used and stopped
  if (!shouldReject && userContext.stoppedProducts?.some(p => p.toLowerCase().includes(normalizedProduct))) {
    breakdown.previouslyUsed = config.previouslyUsed.penalty;
    reason = 'Previously used and stopped';
    // Note: Not rejecting, just penalizing with warning
  }
  
  // Brand loyalty bonus
  if (!shouldReject && productBrand && userContext.lovedBrands) {
    const brandLower = productBrand.toLowerCase();
    const lovedCount = userContext.lovedBrands.filter(b => b.toLowerCase() === brandLower).length;
    
    if (lovedCount >= config.brandLoyalty.minLovedItems) {
      breakdown.brandLoyalty = config.brandLoyalty.bonus;
    }
  }
  
  // Category familiarity bonus
  if (!shouldReject && category && userContext.activeCategories?.includes(category)) {
    breakdown.categoryFamiliarity = config.categoryFamiliarity.bonus;
  }
  
  // Calculate total and cap
  let score = breakdown.alreadyOwns + breakdown.previouslyUsed + breakdown.brandLoyalty + breakdown.categoryFamiliarity;
  score = Math.min(score, config.maxTotalContribution);
  
  return { score, shouldReject, rejectionType, rejectionPriority, reason, breakdown };
}

/**
 * Check if skin types are complementary (Phase 2 NEW)
 */
function isComplementarySkinType(userType: string, productTypes: string[]): boolean {
  const complementaryMap: Record<string, string[]> = {
    'oily': ['combination', 'normal'],
    'dry': ['normal', 'sensitive'],
    'combination': ['oily', 'normal'],
    'sensitive': ['dry', 'normal'],
    'normal': ['oily', 'dry', 'combination', 'sensitive']
  };
  
  const complementary = complementaryMap[userType.toLowerCase()] || [];
  return productTypes.some(t => complementary.includes(t.toLowerCase()));
}

/**
 * Score constraint matching (Phase 2 NEW)
 * 
 * ChatGPT Guardrail #3: Returns rejection with priority for single-rejection logic
 */
function scoreConstraintMatch(
  productName: string,
  productAttributes: string[],
  userConstraints: string[],
  userSkinType: string | undefined,
  productForSkinTypes: string[] | undefined,
  config: typeof UNIFIED_SCORING_CONFIG.constraints
): { 
  score: number; 
  shouldReject: boolean;
  rejectionType?: string;
  rejectionPriority?: number;
  violationReason?: string;
  breakdown: { violation: number; exactMatch: number; partialMatch: number; skinTypeMatch: number }
} {
  const breakdown = {
    violation: 0,
    exactMatch: 0,
    partialMatch: 0,
    skinTypeMatch: 0
  };
  
  const productLower = productName.toLowerCase();
  
  // Check for violations
  for (const constraint of userConstraints) {
    const constraintLower = constraint.toLowerCase();
    
    // Check if constraint is an "avoid" type
    if (constraintLower.startsWith('avoid ')) {
      const avoidTerm = constraintLower.replace('avoid ', '');
      if (productLower.includes(avoidTerm) || 
          productAttributes.some(a => a.toLowerCase().includes(avoidTerm))) {
        breakdown.violation = config.violation.penalty;
        return {
          score: config.violation.penalty,
          shouldReject: true,
          rejectionType: config.violation.rejectionType,
          rejectionPriority: REJECTION_PRIORITY[config.violation.rejectionType],
          violationReason: `Contains ${avoidTerm} (user constraint)`,
          breakdown
        };
      }
    }
    
    // Check direct constraint match
    if (productLower.includes(constraintLower) || 
        productAttributes.some(a => a.toLowerCase().includes(constraintLower))) {
      breakdown.violation = config.violation.penalty;
      return {
        score: config.violation.penalty,
        shouldReject: true,
        rejectionType: config.violation.rejectionType,
        rejectionPriority: REJECTION_PRIORITY[config.violation.rejectionType],
        violationReason: `Contains ${constraint} (user constraint)`,
        breakdown
      };
    }
    
    // Check for positive matches ("prefer X")
    if (constraintLower.startsWith('prefer ')) {
      const preferTerm = constraintLower.replace('prefer ', '');
      if (productLower.includes(preferTerm) || 
          productAttributes.some(a => a.toLowerCase().includes(preferTerm))) {
        breakdown.exactMatch += config.matchBonus.exactMatch;
      }
    }
  }
  
  // Skin type matching
  if (config.skinTypeMatch.enabled && userSkinType && productForSkinTypes?.length) {
    const userSkinLower = userSkinType.toLowerCase();
    if (productForSkinTypes.some(s => s.toLowerCase() === userSkinLower)) {
      breakdown.skinTypeMatch = config.skinTypeMatch.exactMatch;
    } else if (isComplementarySkinType(userSkinType, productForSkinTypes)) {
      breakdown.skinTypeMatch = config.skinTypeMatch.complementary;
    }
  }
  
  // Calculate total and cap
  let score = breakdown.exactMatch + breakdown.partialMatch + breakdown.skinTypeMatch;
  score = Math.min(score, config.maxTotalContribution);
  
  return { score, shouldReject: false, breakdown };
}

/**
 * Select strongest rejection (ChatGPT Guardrail #3)
 * Only store the single strongest rejection reason
 */
function selectStrongestRejection(
  rejections: Array<{ type: string; reason: string; priority: number }>
): { type: string; reason: string } | null {
  if (rejections.length === 0) return null;
  
  // Sort by priority ascending (lower = higher priority)
  rejections.sort((a, b) => a.priority - b.priority);
  
  return { type: rejections[0].type, reason: rejections[0].reason };
}

/**
 * Build score breakdown for transparency (Phase 2 NEW)
 */
function buildScoreBreakdown(
  platformScore: { total: number; reviewCount: number; avgRating: number; recencyAdjustment: number },
  similarUserScore: { total: number; userCount: number; avgSignalStrength: number; negativeOverride: boolean },
  userHistoryScore: { total: number; brandLoyalty: number; categoryFamiliarity: number; previouslyUsedPenalty: number },
  constraintScore: { total: number; matchCount: number; skinTypeMatch: boolean }
): ScoreBreakdown {
  // Check for dominance violation (lower priority source > higher priority source)
  let dominanceViolation = false;
  if (similarUserScore.userCount >= 2 && platformScore.total > similarUserScore.total) {
    dominanceViolation = true;
    console.log('[buildScoreBreakdown] Warning: Platform score exceeds similar-user score when similar users present');
  }
  
  const rawTotal = platformScore.total + similarUserScore.total + userHistoryScore.total + constraintScore.total;
  const cappedTotal = Math.min(rawTotal, UNIFIED_SCORING_CONFIG.global.maxTotalScore);
  
  return {
    platformReview: {
      total: platformScore.total,
      reviewCount: platformScore.reviewCount,
      avgRating: platformScore.avgRating,
      recencyAdjustment: platformScore.recencyAdjustment,
      cappedAt: platformScore.total >= UNIFIED_SCORING_CONFIG.platformReview.maxTotalContribution 
        ? UNIFIED_SCORING_CONFIG.platformReview.maxTotalContribution : null
    },
    similarUser: {
      total: similarUserScore.total,
      userCount: similarUserScore.userCount,
      avgSignalStrength: similarUserScore.avgSignalStrength,
      negativeOverride: similarUserScore.negativeOverride,
      recencyAdjustment: 0,  // TODO: Implement similar-user recency decay
      cappedAt: similarUserScore.total >= UNIFIED_SCORING_CONFIG.similarUser.maxSimilarUserScorePerProduct
        ? UNIFIED_SCORING_CONFIG.similarUser.maxSimilarUserScorePerProduct : null
    },
    userHistory: {
      total: userHistoryScore.total,
      brandLoyalty: userHistoryScore.brandLoyalty,
      categoryFamiliarity: userHistoryScore.categoryFamiliarity,
      previouslyUsedPenalty: userHistoryScore.previouslyUsedPenalty,
      cappedAt: userHistoryScore.total >= UNIFIED_SCORING_CONFIG.userHistory.maxTotalContribution
        ? UNIFIED_SCORING_CONFIG.userHistory.maxTotalContribution : null
    },
    constraintMatch: {
      total: constraintScore.total,
      matchCount: constraintScore.matchCount,
      skinTypeMatch: constraintScore.skinTypeMatch,
      cappedAt: constraintScore.total >= UNIFIED_SCORING_CONFIG.constraints.maxTotalContribution
        ? UNIFIED_SCORING_CONFIG.constraints.maxTotalContribution : null
    },
    rawTotal,
    cappedTotal,
    dominanceViolation
  };
}

/**
 * Log scoring decision for debugging (Phase 2 NEW)
 */
function logScoringDecision(
  product: string,
  breakdown: ScoreBreakdown,
  finalDecision: 'shortlisted' | 'rejected' | 'below_threshold'
): void {
  console.log('[SCORING_DECISION]', JSON.stringify({
    timestamp: new Date().toISOString(),
    product,
    decision: finalDecision,
    breakdown: {
      platformReview: breakdown.platformReview.total.toFixed(3),
      similarUser: breakdown.similarUser.total.toFixed(3),
      userHistory: breakdown.userHistory.total.toFixed(3),
      constraints: breakdown.constraintMatch.total.toFixed(3),
      raw: breakdown.rawTotal.toFixed(3),
      capped: breakdown.cappedTotal.toFixed(3)
    },
    negativeOverride: breakdown.similarUser.negativeOverride,
    skinTypeMatch: breakdown.constraintMatch.skinTypeMatch,
    dominanceViolation: breakdown.dominanceViolation
  }));
}

// ============= RECOMMENDATION RESOLVER (Phase 2 Enhanced) =============

/**
 * Detect product category from user query
 */
function detectCategory(query: string): string | undefined {
  const lowerQuery = query.toLowerCase();
  
  const categoryPatterns: Record<string, RegExp> = {
    skincare: /\b(sunscreen|moisturizer|serum|cleanser|toner|mask|exfoliat|acne|anti-aging|retinol|spf|skin care|skincare|face wash|lotion)\b/i,
    haircare: /\b(shampoo|conditioner|hair oil|hair mask|hair care|haircare|hair treatment|styling|dry shampoo)\b/i,
    makeup: /\b(foundation|lipstick|mascara|eyeshadow|concealer|blush|primer|makeup|cosmetic)\b/i,
    food: /\b(recipe|ingredient|cook|meal|restaurant|diet|nutrition|food|eat|drink|snack)\b/i,
    electronics: /\b(phone|laptop|tablet|headphone|earbuds|computer|monitor|keyboard|mouse|charger|camera|speaker)\b/i,
    fitness: /\b(workout|exercise|gym|protein|supplement|fitness|yoga|running|weight)\b/i,
  };
  
  for (const [category, pattern] of Object.entries(categoryPatterns)) {
    if (pattern.test(lowerQuery)) {
      return category;
    }
  }
  
  return undefined;
}

/**
 * Extract constraints from user preferences as simple string array
 */
function extractConstraintsForResolver(preferences: any): string[] {
  if (!preferences) return [];
  
  const constraints: string[] = [];
  
  // Extract from unified_constraints
  const unifiedItems = preferences.unified_constraints?.items || [];
  for (const item of unifiedItems) {
    if (item.intent === 'never' || item.intent === 'strictly_avoid' || item.intent === 'avoid') {
      constraints.push(item.targetValue.toLowerCase());
    }
  }
  
  // Extract from legacy constraints
  if (preferences.avoidIngredients?.length) {
    constraints.push(...preferences.avoidIngredients.map((i: string) => i.toLowerCase()));
  }
  if (preferences.avoidBrands?.length) {
    constraints.push(...preferences.avoidBrands.map((b: string) => b.toLowerCase()));
  }
  
  return [...new Set(constraints)]; // Deduplicate
}

/**
 * Check if a product violates any user constraints
 */
function checkConstraintViolation(product: string, constraints: string[]): string | null {
  const productLower = product.toLowerCase();
  
  for (const constraint of constraints) {
    if (productLower.includes(constraint) || constraint.includes(productLower.split(' ')[0])) {
      return `Contains ${constraint} (user constraint)`;
    }
  }
  return null;
}

/**
 * Calculate confidence score based on available data
 * 
 * ChatGPT Refinement #2: Only apply outcome signal bonus if 2+ distinct users have signals
 */
function calculateResolverConfidence(
  sourceSummary: ResolverSourceSummary, 
  shortlistCount: number,
  distinctUsersWithSignals: number = 0  // NEW parameter for Phase 1
): { confidence: number; label: 'high' | 'medium' | 'limited' } {
  let confidence = 0;
  
  // Platform reviews contribution (max 0.30)
  confidence += Math.min(sourceSummary.platformReviews * 0.06, 0.30);
  
  // Similar users contribution (max 0.20)
  confidence += Math.min(sourceSummary.similarUsers * 0.04, 0.20);
  
  // NEW: Outcome signals bonus (ChatGPT Refinement #2)
  // Only if 2+ distinct users have signals
  if (distinctUsersWithSignals >= OUTCOME_SCORING_CONFIG.minDistinctUsersForBonus) {
    confidence += 0.15;
  }
  
  // User has tracked items (0.10)
  if (sourceSummary.userItems > 0) confidence += 0.10;
  
  // Shortlist quality (max 0.25)
  confidence += Math.min(shortlistCount * 0.05, 0.25);
  
  const finalConfidence = Math.min(confidence, 1.0);
  
  const label: 'high' | 'medium' | 'limited' = 
    finalConfidence >= 0.7 ? 'high' : 
    finalConfidence >= 0.4 ? 'medium' : 'limited';
  
  return { confidence: finalConfidence, label };
}

/**
 * Log resolver snapshot for debugging
 * 
 * ChatGPT Refinement #4: Include per-user contribution breakdown
 */
function logResolverSnapshot(
  input: ResolverInput, 
  output: ResolverOutput, 
  durationMs: number,
  contributingUsers?: ContributingUserLog[]  // NEW parameter
): void {
  console.log('[RESOLVER_SNAPSHOT]', JSON.stringify({
    timestamp: new Date().toISOString(),
    userId: input.userId,
    query: input.query.substring(0, 100),
    category: input.category,
    state: output.state,
    shortlistCount: output.shortlist.length,
    shortlistProducts: output.shortlist.map(p => ({
      product: p.product,
      score: p.score,
      verified: p.verified,  // Phase 3: Include verification status
      signals: p.signals
    })),
    rejectedCount: output.rejected.length,
    confidence: output.confidence.toFixed(2),
    confidenceLabel: output.confidenceLabel,
    sources: output.sourceSummary,
    // Phase 3: Web fallback details
    webFallback: {
      attempted: output.sourceSummary.webSearchAttempted,
      used: output.sourceSummary.webSearchUsed,
      failureReason: output.sourceSummary.webSearchFailureReason,
      productsAdded: output.shortlist.filter(p => !p.verified).length,
      confidenceAtTrigger: output.confidence
    },
    // Per-user contribution breakdown (ChatGPT Refinement #4)
    contributingUsers: contributingUsers?.map(u => ({
      id: u.userId.substring(0, 8) + '...',
      strength: u.signalStrength.toFixed(2),
      products: u.products.length
    })),
    durationMs
  }));
}

/**
 * Aggregate sources by type
 */
function aggregateSources(sources: ResolverProductSource[]): ResolverProductSource[] {
  const aggregated = new Map<string, number>();
  
  for (const source of sources) {
    const current = aggregated.get(source.type) || 0;
    aggregated.set(source.type, current + source.count);
  }
  
  return Array.from(aggregated.entries()).map(([type, count]) => ({
    type: type as ResolverProductSource['type'],
    count
  }));
}

/**
 * CORE RESOLVER: Runs BEFORE the LLM for product_user queries
 * This is deterministic - no LLM calls inside
 */
async function resolveRecommendation(
  supabaseClient: any,
  input: ResolverInput
): Promise<ResolverOutput> {
  const startTime = Date.now();
  
  // Initialize output structure
  const output: ResolverOutput = {
    state: 'success',
    shortlist: [],
    rejected: [],
    userContext: { 
      constraints: input.constraints, 
      currentProducts: [] 
    },
    confidence: 0,
    confidenceLabel: 'limited',
    sourceSummary: { 
      platformReviews: 0, 
      similarUsers: 0, 
      userItems: 0, 
      webSearchUsed: false,
      webSearchAttempted: false,
      webSearchFailureReason: undefined
    }
  };

  console.log('[resolveRecommendation] Starting resolver for query:', input.query.substring(0, 80));

  // Step 1: Load User Context (ALWAYS runs)
  try {
    const userContextResult = await getUserContext(supabaseClient, input.userId, 'preferences');
    if (userContextResult.success && userContextResult.data) {
      output.userContext.skinType = userContextResult.data.preferences?.skin_type?.values?.[0]?.value;
      output.userContext.hairType = userContextResult.data.preferences?.hair_type?.values?.[0]?.value;
    }
  } catch (error) {
    console.error('[resolveRecommendation] Error loading user context:', error);
  }

  // Step 2: Get User's Stuff (ALWAYS runs) - ENHANCED for Phase 2
  try {
    // Get currently using items
    const userStuffResult = await getUserStuff(supabaseClient, input.userId, input.category);
    if (userStuffResult.success && userStuffResult.items) {
      output.userContext.currentProducts = userStuffResult.items
        .map((item: any) => item.entity?.name)
        .filter(Boolean)
        .slice(0, 10);
      output.sourceSummary.userItems = output.userContext.currentProducts.length;
    }
    
    // Phase 2 NEW: Get stopped products for user history scoring
    const stoppedItems = await supabaseClient
      .from('user_stuff')
      .select('entity:entity_id(name)')
      .eq('user_id', input.userId)
      .eq('status', 'stopped_using')
      .limit(20);
    
    if (stoppedItems.data) {
      output.userContext.stoppedProducts = stoppedItems.data
        .map((i: any) => i.entity?.name)
        .filter(Boolean);
    }
    
    // Phase 2 NEW: Get loved brands (items with high sentiment or 'favorite' status)
    const lovedItems = await supabaseClient
      .from('user_stuff')
      .select('entity:entity_id(name, metadata)')
      .eq('user_id', input.userId)
      .or('status.eq.favorite,sentiment_score.gte.4')
      .limit(30);
    
    if (lovedItems.data) {
      // Extract brand names from loved items (would need entity.metadata.brand)
      output.userContext.lovedBrands = lovedItems.data
        .map((i: any) => i.entity?.metadata?.brand)
        .filter(Boolean);
    }
    
    // Set active categories
    output.userContext.activeCategories = input.category ? [input.category] : [];
    
  } catch (error) {
    console.error('[resolveRecommendation] Error loading user stuff:', error);
  }

  /**
   * ARCHITECTURE INVARIANT (Phase 2 - ChatGPT Final #1):
   * - Candidate generation (Steps 3-4) introduces products into productScores
   * - Scoring functions (Steps 4.5-5) ONLY adjust weights of existing candidates
   * - No scoring function may introduce new candidates
   * - This separation enables clean Phase 3 web grounding
   */
  
  // Step 3: Search Platform Reviews with Enhanced Scoring (Phase 2)
  const productScores = new Map<string, {
    score: number; 
    reasons: string[]; 
    sources: ResolverProductSource[];
    entityId?: string;
    signals?: ResolverShortlistItem['signals'];
    // Phase 2 NEW: Per-source tracking for score breakdown
    platformReviewScore: { total: number; reviewCount: number; avgRating: number; recencyAdjustment: number };
    similarUserScore: { total: number; userCount: number; avgSignalStrength: number; negativeOverride: boolean };
    userHistoryScore: { total: number; brandLoyalty: number; categoryFamiliarity: number; previouslyUsedPenalty: number };
    constraintScore: { total: number; matchCount: number; skinTypeMatch: boolean };
    productBrand?: string;
    productAttributes?: string[];
    productForSkinTypes?: string[];
  }>();

  try {
    const reviewsResult = await searchReviewsSemantic(supabaseClient, input.query, undefined, 15);
    if (reviewsResult.success && reviewsResult.results) {
      output.sourceSummary.platformReviews = reviewsResult.results.length;
      
      for (const review of reviewsResult.results) {
        const productName = review.entity?.name;
        if (!productName) continue;
        
        // Phase 2: Use enhanced platform review scoring with recency decay
        const reviewScore = scorePlatformReview(
          {
            rating: review.rating || 3,
            relevance_score: review.relevance_score || 0.5,
            created_at: review.created_at
          },
          UNIFIED_SCORING_CONFIG.platformReview
        );
        
        const existing = productScores.get(productName) || {
          score: 0, 
          reasons: [], 
          sources: [],
          entityId: review.entity?.id,
          entityType: review.entity?.type, // Capture entity type for frontend cards
          platformReviewScore: { total: 0, reviewCount: 0, avgRating: 0, recencyAdjustment: 0 },
          similarUserScore: { total: 0, userCount: 0, avgSignalStrength: 0, negativeOverride: false },
          userHistoryScore: { total: 0, brandLoyalty: 0, categoryFamiliarity: 0, previouslyUsedPenalty: 0 },
          constraintScore: { total: 0, matchCount: 0, skinTypeMatch: false },
          productBrand: undefined,
          productAttributes: [],
          productForSkinTypes: []
        };
        
        existing.score += reviewScore.score;
        existing.platformReviewScore.total += reviewScore.score;
        existing.platformReviewScore.reviewCount += 1;
        existing.platformReviewScore.avgRating = 
          ((existing.platformReviewScore.avgRating * (existing.platformReviewScore.reviewCount - 1)) + (review.rating || 3)) 
          / existing.platformReviewScore.reviewCount;
        existing.platformReviewScore.recencyAdjustment += reviewScore.breakdown.recency;
        
        // Add reason if we don't have too many already
        if (existing.reasons.length < 2) {
          existing.reasons.push(`${review.rating || 3}/5 on Common Groundz`);
        }
        existing.sources.push({ type: 'platform_review', count: 1 });
        existing.entityId = review.entity?.id;
        
        // Cap platform review contribution (Phase 2 Guardrail #2)
        if (existing.platformReviewScore.total > UNIFIED_SCORING_CONFIG.platformReview.maxTotalContribution) {
          const excess = existing.platformReviewScore.total - UNIFIED_SCORING_CONFIG.platformReview.maxTotalContribution;
          existing.score -= excess;
          existing.platformReviewScore.total = UNIFIED_SCORING_CONFIG.platformReview.maxTotalContribution;
        }
        
        productScores.set(productName, existing);
      }
      
      console.log('[resolveRecommendation] Found', reviewsResult.results.length, 'platform reviews with recency scoring');
    }
  } catch (error) {
    console.error('[resolveRecommendation] Error searching reviews:', error);
  }

  // Step 4: Find Similar Users and Get Their Recommendations (PHASE 1 ENHANCED)
  let contributingUsersLog: ContributingUserLog[] = [];
  let totalDistinctUsersWithSignals = 0;

  try {
    const similarUsersResult = await findSimilarUsers(supabaseClient, input.userId, 8);
    
    if (similarUsersResult.success && similarUsersResult.results?.length > 0) {
      output.sourceSummary.similarUsers = similarUsersResult.results.length;
      console.log('[resolveRecommendation] Found', similarUsersResult.results.length, 'similar users');
      
      // Step 4a: Get candidates with outcome signals
      const similarUserIds = similarUsersResult.results.map((u: any) => u.user_id || u.id);
      const candidates = await getSimilarUserCandidates(
        supabaseClient,
        similarUserIds,
        input.category,
        OUTCOME_SCORING_CONFIG.activeWithinDays
      );
      
      console.log('[resolveRecommendation] Generated', candidates.length, 'candidate products from similar users');
      
      // Step 4b: Score and merge into productScores
      for (const candidate of candidates) {
        const scoreResult = applySimilarUserScore(candidate, OUTCOME_SCORING_CONFIG);
        
        // Skip if not enough users (ChatGPT Add #1)
        if (scoreResult.skipScoring) {
          console.log('[resolveRecommendation] Skipping', candidate.entityName, '- insufficient users');
          continue;
        }
        
        // Track distinct users with signals for confidence calculation
        totalDistinctUsersWithSignals = Math.max(
          totalDistinctUsersWithSignals, 
          candidate.aggregatedSignals.distinctUsersWithSignals
        );
        
        const existing = productScores.get(candidate.entityName) || {
          score: 0, 
          reasons: [], 
          sources: [],
          entityId: candidate.entityId,
          signals: {
            platformReviews: 0,
            avgPlatformRating: 0,
            similarUsers: 0,
            stillUsingCount: 0,
            stoppedUsingCount: 0,
            avgUsageDurationMonths: 0,
            hasTimelineCount: 0,
            ratingTrajectoryPositive: 0,
            negativeOverrideApplied: false
          }
        };
        
        existing.score += scoreResult.score;
        
        // Store factual signals (LLM converts to language)
        existing.signals = {
          platformReviews: existing.signals?.platformReviews || 0,
          avgPlatformRating: existing.signals?.avgPlatformRating || 0,
          similarUsers: candidate.aggregatedSignals.totalUsers,
          stillUsingCount: candidate.aggregatedSignals.stillUsingCount,
          stoppedUsingCount: candidate.aggregatedSignals.stoppedUsingCount,
          avgUsageDurationMonths: calculateAvgUsageDuration(candidate.recommendedByUsers),
          hasTimelineCount: candidate.aggregatedSignals.hasTimelineCount,
          ratingTrajectoryPositive: candidate.recommendedByUsers.filter(u => u.signals.ratingTrajectory === 'improving').length,
          negativeOverrideApplied: scoreResult.negativeOverrideApplied
        };
        
        existing.sources.push({
          type: 'similar_user',
          count: candidate.aggregatedSignals.totalUsers
        });
        
        productScores.set(candidate.entityName, existing);
        
        // Track contributing users for logging (ChatGPT Refinement #4)
        for (const user of candidate.recommendedByUsers) {
          let userLog = contributingUsersLog.find(u => u.userId === user.userId);
          if (!userLog) {
            userLog = { userId: user.userId, signalStrength: user.signals.signalStrength, products: [] };
            contributingUsersLog.push(userLog);
          }
          userLog.products.push(candidate.entityName);
        }
      }
      
      console.log('[resolveRecommendation] Processed', candidates.length, 'similar user candidates, distinct users with signals:', totalDistinctUsersWithSignals);
    }
  } catch (error) {
    console.error('[resolveRecommendation] Error processing similar users:', error);
  }

  // Update source summary with distinct users count
  output.sourceSummary.distinctUsersWithSignals = totalDistinctUsersWithSignals;

  // Step 4.5: Apply User History Scoring (Phase 2 NEW)
  for (const [product, data] of productScores.entries()) {
    const historyScore = scoreUserHistory(
      product,
      data.productBrand || null,
      output.userContext,
      input.category,
      UNIFIED_SCORING_CONFIG.userHistory
    );
    
    if (historyScore.shouldReject) {
      output.rejected.push({
        product,
        reason: historyScore.reason || 'User history conflict',
        rejectionType: historyScore.rejectionType as any,
        priority: historyScore.rejectionPriority
      });
      productScores.delete(product);
    } else {
      data.score += historyScore.score;
      data.userHistoryScore = {
        total: historyScore.score,
        brandLoyalty: historyScore.breakdown.brandLoyalty,
        categoryFamiliarity: historyScore.breakdown.categoryFamiliarity,
        previouslyUsedPenalty: historyScore.breakdown.previouslyUsed
      };
    }
  }

  // Step 5: Apply Constraint Scoring and Build Shortlist (Phase 2 ENHANCED)
  for (const [product, data] of productScores.entries()) {
    const constraintScore = scoreConstraintMatch(
      product,
      data.productAttributes || [],
      input.constraints,
      output.userContext.skinType,
      data.productForSkinTypes,
      UNIFIED_SCORING_CONFIG.constraints
    );
    
    if (constraintScore.shouldReject) {
      output.rejected.push({
        product,
        reason: constraintScore.violationReason || 'Constraint violation',
        rejectionType: constraintScore.rejectionType as any,
        priority: constraintScore.rejectionPriority
      });
    } else {
      data.score += constraintScore.score;
      data.constraintScore = {
        total: constraintScore.score,
        matchCount: constraintScore.breakdown.exactMatch > 0 ? 1 : 0,
        skinTypeMatch: constraintScore.breakdown.skinTypeMatch > 0
      };
      
      // Apply global cap
      const cappedScore = Math.min(data.score, UNIFIED_SCORING_CONFIG.global.maxTotalScore);
      
      // Only add if meets minimum threshold
      if (cappedScore >= UNIFIED_SCORING_CONFIG.global.minScoreForShortlist) {
        // Build score breakdown for transparency
        const scoreBreakdown = buildScoreBreakdown(
          data.platformReviewScore,
          data.similarUserScore || { total: 0, userCount: 0, avgSignalStrength: 0, negativeOverride: false },
          data.userHistoryScore,
          data.constraintScore
        );
        
        // Log scoring decision
        logScoringDecision(product, scoreBreakdown, 'shortlisted');
        
        // Create merged signals with platform review data for frontend Top Pick logic
        const mergedSignals = {
          ...data.signals,
          // Sync platform review data (these were tracked separately)
          platformReviews: data.platformReviewScore?.reviewCount || data.signals?.platformReviews || 0,
          avgPlatformRating: data.platformReviewScore?.avgRating || data.signals?.avgPlatformRating || 0,
          // Direct frontend-expected field names
          avgRating: data.platformReviewScore?.avgRating || data.signals?.avgPlatformRating || 0,
          reviewCount: data.platformReviewScore?.reviewCount || data.signals?.platformReviews || 0,
        };

        // Debug assertion: warn if signals mismatch occurs
        if (mergedSignals.reviewCount === 0 && data.platformReviewScore?.reviewCount > 0) {
          console.warn('[signals-mismatch] Platform reviews exist but not synced:', {
            entityId: data.entityId,
            platformReviewCount: data.platformReviewScore.reviewCount,
            signalsReviewCount: mergedSignals.reviewCount
          });
        }

        output.shortlist.push({
          product,
          entityId: data.entityId,
          entityType: data.entityType || null, // For frontend card rendering
          score: cappedScore,
          reason: data.reasons.length > 0 ? data.reasons.join('; ') : 'Matches your criteria',
          signals: mergedSignals,  // Now includes platform review data!
          scoreBreakdown,
          sources: aggregateSources(data.sources),
          verified: true  // Phase 3: Platform items are verified (Guardrail #2)
        });
      }
    }
  }

  // Step 6: Sort and Cap Shortlist (MAX 5 items - ChatGPT Guardrail #3)
  output.shortlist.sort((a, b) => b.score - a.score);
  output.shortlist = output.shortlist.slice(0, 5);

  // Step 7: Calculate Confidence (DETERMINISTIC formula with outcome signals bonus)
  const { confidence, label } = calculateResolverConfidence(
    output.sourceSummary, 
    output.shortlist.length,
    totalDistinctUsersWithSignals  // NEW: Pass for Phase 1 confidence bonus
  );
  output.confidence = confidence;
  output.confidenceLabel = label;

  // Step 8: Handle Insufficient Data (Phase 2 ENHANCED - ChatGPT Final #2)
  const insufficientDataConfig = UNIFIED_SCORING_CONFIG.insufficientData;
  const hasInsufficientData = 
    output.shortlist.length < insufficientDataConfig.minShortlistItems ||
    output.confidence < insufficientDataConfig.minConfidence ||
    (output.sourceSummary.similarUsers < insufficientDataConfig.minSimilarUsers &&
     output.sourceSummary.platformReviews < insufficientDataConfig.minPlatformReviews);

  if (hasInsufficientData) {
    output.state = 'insufficient_data';
    
    // Generate specific message based on what's missing
    if (output.sourceSummary.similarUsers < 2 && output.sourceSummary.platformReviews < 3) {
      output.fallbackMessage = "I don't have enough data from users like you or from Common Groundz reviews in this category yet. Would you like me to search broader sources?";
    } else if (output.sourceSummary.similarUsers < 2) {
      output.fallbackMessage = "I found some platform reviews, but not enough data from users with similar preferences. Would you like me to search broader sources?";
    } else {
      output.fallbackMessage = "I don't have enough trusted data yet to recommend confidently. Would you like me to search broader sources?";
    }
    
    logResolverSnapshot(input, output, Date.now() - startTime, contributingUsersLog);
    return output;
  }

  /**
   * PHASE 3 INVARIANT (Guardrail #4):
   * Web fallback supplements missing candidates but NEVER increases trust,
   * confidence, or overrides platform dominance.
   * 
   * - Confidence was computed in Step 7 and is FROZEN (Guardrail #3)
   * - Web results capped at maxTotalWebContribution (Guardrail #1)
   * - All web items marked verified: false (Guardrail #2)
   * - Verified items always rank above unverified (Guardrail #7)
   */
  
  // Step 9: Web Fallback Decision (Phase 3 - Full Implementation)
  const webConfig = UNIFIED_SCORING_CONFIG.webFallback;
  const shouldTriggerWebFallback = 
    output.confidence < webConfig.triggerConditions.confidenceBelow &&
    output.shortlist.length < webConfig.triggerConditions.shortlistBelow;

  if (shouldTriggerWebFallback) {
    console.log('[resolveRecommendation] Low confidence, triggering web fallback search');
    output.sourceSummary.webSearchAttempted = true;
    
    const webResults = await webFallbackSearch(
      input.query,
      input.category || 'product',
      output.shortlist.map(p => p.product),
      input.constraints,
      webConfig
    );
    
    if (webResults.success && webResults.products.length > 0) {
      output.state = 'web_fallback';
      output.sourceSummary.webSearchUsed = true;
      output.fallbackMessage = 'Limited Common Groundz data - supplementing with broader web research.';
      
      // Guardrail #1: Track total web contribution
      let totalWebContribution = 0;
      
      for (const webProduct of webResults.products) {
        // Check if adding this would exceed total web cap
        const productScore = Math.min(webProduct.score, webConfig.scoring.maxScorePerWebResult);
        if (totalWebContribution + productScore > webConfig.scoring.maxTotalWebContribution) {
          console.log('[resolveRecommendation] Skipping web product, would exceed total cap:', webProduct.name);
          break;
        }
        
        totalWebContribution += productScore;
        
        // Guardrail #2: Mark as unverified
        output.shortlist.push({
          product: webProduct.name,
          entityId: undefined,
          score: productScore,
          reason: webProduct.reason,
          signals: undefined,
          scoreBreakdown: undefined,
          sources: [{ type: 'web', count: 1 }],
          verified: false  // GUARDRAIL: Web results are not verified
        });
      }
      
      // Guardrail #7: Verified items ALWAYS rank above unverified
      output.shortlist.sort((a, b) => {
        if (a.verified !== b.verified) {
          return a.verified ? -1 : 1; // verified always wins
        }
        return b.score - a.score;
      });
      output.shortlist = output.shortlist.slice(0, 5);
      
      console.log('[resolveRecommendation] Web fallback added products:', webResults.products.length);
    } else {
      // Web search failed or returned nothing
      output.sourceSummary.webSearchUsed = false;
      output.sourceSummary.webSearchFailureReason = webResults.failureReason;
      
      if (webResults.timedOut) {
        output.state = 'insufficient_data';
        output.fallbackMessage = "I couldn't complete the search in time. Could you try again or tell me more about what you're looking for?";
      } else {
        output.state = 'insufficient_data';
        output.fallbackMessage = "I couldn't find enough trusted data for this recommendation. Could you tell me more about what you're looking for?";
      }
    }
  } else {
    output.sourceSummary.webSearchAttempted = false;
    output.sourceSummary.webSearchUsed = false;
  }

  // Step 10: Log Resolver Snapshot (ChatGPT Refinement #4 - with per-user breakdown)
  logResolverSnapshot(input, output, Date.now() - startTime, contributingUsersLog);

  return output;
}

// ============= PHASE 3: WEB FALLBACK SEARCH =============

interface WebFallbackResult {
  success: boolean;
  products: Array<{
    name: string;
    reason: string;
    url?: string;
    score: number;
  }>;
  searchQuery: string;
  sourcesCount: number;
  timedOut: boolean;
  failureReason?: string;
}

/**
 * Phase 3: Web Fallback Search
 * Uses Gemini's google_search grounding to find products
 * Only called when platform confidence is too low
 * 
 * INVARIANT: This function GENERATES candidates, not scores them.
 * Web results are added to shortlist with fixed reduced scoring.
 */
async function webFallbackSearch(
  query: string,
  category: string,
  existingProducts: string[],
  userConstraints: string[],
  config: typeof UNIFIED_SCORING_CONFIG.webFallback
): Promise<WebFallbackResult> {
  const startTime = Date.now();
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  if (!GEMINI_API_KEY) {
    console.error('[webFallbackSearch] Missing GEMINI_API_KEY');
    return { 
      success: false, 
      products: [], 
      searchQuery: '', 
      sourcesCount: 0, 
      timedOut: false,
      failureReason: 'Missing API key'
    };
  }
  
  // Build search query with year context and category
  const currentYear = new Date().getFullYear();
  const searchQuery = config.search.categoryPrefix 
    ? `best ${category} ${query} reviews ${currentYear} ${currentYear - 1}`
    : `best ${query} reviews ${currentYear}`;
  
  console.log('[webFallbackSearch] Starting web search:', { query: searchQuery, category });
  
  // Timeout protection (Guardrail #6)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout.maxMs);
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Find the top 5 ${category} products for: "${query}".
              
Requirements:
- Return ONLY product names, one per line
- Focus on products with good reviews
- Exclude: ${existingProducts.join(', ') || 'none'}
- User constraints to respect: ${userConstraints.join(', ') || 'none'}

Return format:
1. Product Name - Brief reason
2. Product Name - Brief reason
...`
            }]
          }],
          tools: [{ google_search: {} }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('[webFallbackSearch] Gemini API error:', response.status);
      return { 
        success: false, 
        products: [], 
        searchQuery, 
        sourcesCount: 0, 
        timedOut: false,
        failureReason: `API error: ${response.status}`
      };
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const groundingMeta = data.candidates?.[0]?.groundingMetadata;
    
    // Parse product names from response
    const products: WebFallbackResult['products'] = [];
    const lines = content.split('\n').filter((l: string) => l.trim());
    
    for (const line of lines) {
      const match = line.match(/^\d*[.\-\)]*\s*\*?\*?([A-Z][^-:]+?)\*?\*?\s*[-:]\s*(.+)/i);
      if (match) {
        const productName = match[1].trim().replace(/\*\*/g, '');
        const reason = match[2].trim();
        
        // Skip if already in existing products
        if (config.search.excludeExistingProducts && 
            existingProducts.some(p => p.toLowerCase().includes(productName.toLowerCase()))) {
          continue;
        }
        
        // Skip if violates user constraints
        const violatesConstraint = userConstraints.some(c => {
          const constraintLower = c.toLowerCase();
          if (constraintLower.startsWith('avoid ')) {
            const avoidTerm = constraintLower.replace('avoid ', '');
            return productName.toLowerCase().includes(avoidTerm);
          }
          return productName.toLowerCase().includes(constraintLower);
        });
        
        if (violatesConstraint) continue;
        
        products.push({
          name: productName,
          reason: `Web research: ${reason}`,
          score: config.scoring.baseScore
        });
        
        if (products.length >= config.scoring.maxWebResultsToAdd) break;
      }
    }
    
    // Extract source URLs from grounding metadata
    let sourcesCount = 0;
    if (groundingMeta?.groundingChunks?.length > 0) {
      sourcesCount = groundingMeta.groundingChunks.length;
    }
    
    console.log('[webFallbackSearch] Completed:', { 
      productsFound: products.length, 
      sourcesCount,
      duration: Date.now() - startTime 
    });
    
    return {
      success: true,
      products,
      searchQuery,
      sourcesCount,
      timedOut: false
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Check if it was a timeout
    if (error.name === 'AbortError') {
      console.warn('[webFallbackSearch] Timed out after', config.timeout.maxMs, 'ms');
      return { 
        success: false, 
        products: [], 
        searchQuery, 
        sourcesCount: 0, 
        timedOut: true,
        failureReason: 'Timeout'
      };
    }
    
    console.error('[webFallbackSearch] Error:', error);
    return { 
      success: false, 
      products: [], 
      searchQuery, 
      sourcesCount: 0, 
      timedOut: false,
      failureReason: error.message || 'Unknown error'
    };
  }
}

/**
 * Build the explanation-only prompt for the LLM
 * The LLM receives structured data and explains ONLY - no tool calls
 * 
 * PHASE 1: Now includes factual outcome signals for the LLM to convert to natural language
 */
function buildResolverExplanationPrompt(
  output: ResolverOutput, 
  userName: string
): string {
  const confidenceText = output.confidenceLabel === 'high' ? 'HIGH - Strong platform data with outcome signals' : 
                         output.confidenceLabel === 'medium' ? 'MEDIUM - Some platform insights available' : 
                         'LIMITED - Mostly external research';
  
  return `You are explaining personalized recommendations to ${userName}.

=== USER CONTEXT ===
- Skin Type: ${output.userContext.skinType || 'Not specified'}
- Hair Type: ${output.userContext.hairType || 'Not specified'}
- Dietary Needs: ${output.userContext.dietaryNeeds?.join(', ') || 'None specified'}
- Current Products: ${output.userContext.currentProducts.join(', ') || 'None tracked'}
- Things to Avoid: ${output.userContext.constraints.join(', ') || 'None'}

=== SHORTLISTED PRODUCTS (with factual signals) ===
${output.shortlist.length > 0 ? output.shortlist.map((p, i) => {
  const sig = p.signals;
  const verifiedStatus = p.verified ? '✓ Platform verified' : '🌐 Web research (unverified)';
  const signalLines = sig ? `
   Signals:
   - Platform reviews: ${sig.platformReviews} (avg ${sig.avgPlatformRating.toFixed(1)}/5)
   - Similar users using: ${sig.similarUsers}
   - Still using long-term: ${sig.stillUsingCount}
   - Stopped using: ${sig.stoppedUsingCount}
   - Avg usage duration: ${sig.avgUsageDurationMonths} months
   - Have timeline updates: ${sig.hasTimelineCount}
   - Rating improving over time: ${sig.ratingTrajectoryPositive}
   ${sig.negativeOverrideApplied ? '⚠️ WARNING: More users stopped than continued using this product' : ''}` : '';
  
  return `${i+1}. ${p.product} (score: ${p.score.toFixed(2)}) [${verifiedStatus}]
   - Why: ${p.reason}
   - Sources: ${p.sources.map(s => s.type + ': ' + s.count).join(', ')}${signalLines}`;
}).join('\n\n') : 'No products matched the criteria from Common Groundz data.'}

${output.rejected.length > 0 ? `
=== EXCLUDED (due to user constraints) ===
${output.rejected.map(p => '- ' + p.product + ': ' + p.reason).join('\n')}
` : ''}

=== DATA SOURCES ===
- Common Groundz reviews: ${output.sourceSummary.platformReviews}
- Similar users consulted: ${output.sourceSummary.similarUsers}
- Users with outcome signals: ${output.sourceSummary.distinctUsersWithSignals || 0}
- User's tracked items: ${output.sourceSummary.userItems}
${output.sourceSummary.webSearchUsed ? '- Web research: Yes (' + output.fallbackMessage + ')' : ''}

=== CONFIDENCE: ${confidenceText} ===

${output.sourceSummary.webSearchUsed ? `
=== WEB FALLBACK NOTICE ===
Some recommendations come from broader web research because Common Groundz 
doesn't have enough data in this category yet. Web-sourced products are 
marked with [🌐 Web research (unverified)] and should be treated as less verified.

When explaining web-sourced products:
- Always prefix with "Based on broader research..."
- Do NOT claim these are verified by Common Groundz users
- Be honest that platform data is limited
- Encourage users to share their experiences if they try these products
` : ''}

=== CONVERT SIGNALS TO NATURAL LANGUAGE ===
Use the factual signals above to explain recommendations naturally.

Examples:
- "6 similar users" + "4 still using" + "8 months avg" → "6 users with similar preferences have been using this for 8+ months, and 4 are still loving it"
- "hasTimelineCount: 3" → "3 users have updated their reviews over time, showing ongoing satisfaction"
- "stoppedUsingCount: 3, stillUsingCount: 1" → "Worth noting: 3 similar users stopped using this over time"
- If negativeOverrideApplied is true, clearly communicate this is a warning sign

=== STRICT INSTRUCTIONS (NON-NEGOTIABLE) ===
1. Explain WHY these products fit THIS specific user
2. Reference their constraints when products were excluded
3. Do NOT introduce products not listed above
4. Do NOT invent features, reviews, or opinions not in signals
5. Do NOT create rankings or scores - they are provided above
6. If confidence is LIMITED, say "Based on broader research..."
7. Convert the signals above to natural language explanations
8. Be concise - the signals above are your ONLY source of truth
9. If no products matched, acknowledge honestly and ask what they're looking for
10. Start with a clear recommendation, not preamble
11. If any product has [🌐 Web research (unverified)], clearly state it's from web research, not platform data
12. For web-sourced products, use phrases like "Based on broader research..." or "According to web reviews..."
13. NEVER imply web results are as trusted as platform-verified recommendations

=== CARD-AWARE NARRATION RULES ===
When product cards will be shown in the UI (which they always are for recommendations):
14. Keep your text to 1-2 contextual sentences ONLY
15. Do NOT list entity/product names in text - the cards show these
16. Do NOT mention ratings or review counts in text - the cards show these
17. Do NOT use bullet points to list products - the cards are the list
18. Your job is to explain WHY these are good matches, not WHAT they are
19. Focus on context: user preferences, category insights, or decision guidance

=== ANTI-HEDGING RULES (CRITICAL) ===
20. Do NOT hedge or add disclaimers - let the ratings in cards speak for themselves
21. Do NOT use phrases like "While some...", "However...", "Keep in mind...", "That said..."
22. Do NOT say "While one of the options has received... some have also reported..."
23. Do NOT add defensive language about mixed reviews - the cards show rating variance
24. Be CONFIDENT and CONCISE - uncertainty is conveyed through ratings, not text
25. If data is limited, say so briefly once, then move on

Example good response: "Popular spots among Common Groundz users for a relaxed day in Bangalore."
Example bad response: "While one of the options has received top ratings, some have also reported a less positive experience."
`;
}

// ========== DETECTED PREFERENCE TYPES ==========

interface DetectedPreferenceInfo {
  trigger: boolean;
  reason?: string;
  preferenceType?: 'avoid' | 'preference';
  extractedValue?: string;
  scope?: string;
  confidence?: number;
  targetType?: 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule';
}

// Pattern definitions with confidence scores
const PREFERENCE_PATTERNS = [
  // High confidence (0.9+) - Very explicit statements
  { pattern: /\bi(?:'m| am) allergic to\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.95, scope: 'health' },
  { pattern: /\bi have (?:a )?(.+?) allergy/i, type: 'avoid' as const, confidence: 0.95, scope: 'health' },
  { pattern: /\bi(?:'m| am) (?:highly )?sensitive to\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'health' },
  { pattern: /\bi never (?:use|eat|consume|watch|read)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'general' },
  { pattern: /\bi always avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.9, scope: 'general' },
  
  // Good confidence (0.8-0.89) - Clear preferences
  { pattern: /\bi avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.85, scope: 'general' },
  { pattern: /\bi(?:'m| am) (?:vegan|vegetarian|pescatarian)/i, type: 'preference' as const, confidence: 0.85, scope: 'food', extractFixed: true },
  { pattern: /\bi(?:'m| am) gluten[- ]?free/i, type: 'avoid' as const, confidence: 0.85, scope: 'food', extractValue: 'gluten' },
  { pattern: /\bi can(?:'t|not) (?:eat|use|have|stand|tolerate)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.85, scope: 'general' },
  
  // CONFIDENCE & ORDERING GUARDRAIL
  // This generalized avoid-pattern intentionally uses confidence 0.85.
  // Do NOT raise its confidence above medical/allergy patterns (0.95+).
  // Any future pattern with confidence >= 0.9 MUST be placed ABOVE this block.
  // Pattern matching is first-match-wins.
  { 
    pattern: /\bi (?:don(?:'t| not)|never|avoid|can(?:'t| not))\s+(?:use|eat|drink|watch|read|consume|have|want|listen to)\s+(.+?)(?:\.|,|$)/i, 
    type: 'avoid' as const, 
    confidence: 0.85, 
    scope: 'general' 
  },
  
  // INTENT-LEVEL COMMITMENT PATTERN
  // NOTE: This pattern captures *commitment intent*, not confirmed habit.
  // Confidence intentionally capped at 0.85.
  // Must remain below medical/allergy rules (0.95+).
  // Covers: "From now on I will avoid X", "I'll avoid X", "Going forward I'm gonna avoid X"
  // The (?!not\b) negative look-ahead prevents matching "I will avoid not X" false positives
  { 
    pattern: /\b(?:from now on|going forward|in the future)?\s*(?:i\s*(?:will|am going to|gonna|'ll))\s*avoid\s+(?!not\b)(.+?)(?:\.|,|$)/i, 
    type: 'avoid' as const, 
    confidence: 0.85, 
    scope: 'general' 
  },
  
  { pattern: /\bi(?:'ve| have) (?:oily|dry|sensitive|combination) skin/i, type: 'preference' as const, confidence: 0.85, scope: 'skincare', extractFixed: true },
  { pattern: /\bmy skin (?:type )?is\s+(\w+)/i, type: 'preference' as const, confidence: 0.85, scope: 'skincare' },
  { pattern: /\bmy hair (?:type )?is\s+(\w+)/i, type: 'preference' as const, confidence: 0.85, scope: 'haircare' },
  { pattern: /\bi prefer\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.8, scope: 'general' },
  { pattern: /\bi love\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.8, scope: 'general' },
  { pattern: /\bi hate\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.8, scope: 'general' },
  
  // Medium confidence (0.7-0.79) - Less explicit
  { pattern: /\bi don't like\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.75, scope: 'general' },
  { pattern: /\bi like\s+(.+?)(?:\.|,|$)/i, type: 'preference' as const, confidence: 0.75, scope: 'general' },
  { pattern: /\bi usually (?:avoid|skip)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.7, scope: 'general' },
  
  // Low confidence (<0.7) - Vague statements (won't show chips, only LFC)
  { pattern: /\bi sometimes avoid\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.5, scope: 'general' },
  { pattern: /\bi(?:'m| am) not (?:a fan of|into)\s+(.+?)(?:\.|,|$)/i, type: 'avoid' as const, confidence: 0.6, scope: 'general' },
];

function inferScope(value: string, defaultScope: string): string {
  const lowerValue = value.toLowerCase();
  
  // Food-related
  if (/\b(caffeine|dairy|gluten|nuts|shellfish|soy|eggs?|meat|fish|sugar|carbs?|alcohol)\b/.test(lowerValue)) {
    return 'food';
  }
  // Skincare-related
  if (/\b(retinol|fragrance|parabens?|sulfates?|alcohol|vitamin c|acids?|niacinamide|hyaluronic)\b/.test(lowerValue)) {
    return 'skincare';
  }
  // Entertainment-related
  if (/\b(horror|comedy|romance|action|thriller|drama|sci-fi|documentary|anime)\b/.test(lowerValue)) {
    return 'entertainment';
  }
  
  return defaultScope;
}

function inferTargetType(value: string, scope: string): 'ingredient' | 'brand' | 'genre' | 'food_type' | 'format' | 'rule' {
  const lowerValue = value.toLowerCase();
  
  // Behavioral/temporal rules (should display in General/Other category)
  const behaviorPatterns = [
    /\b(before|after)\s+\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)?/i,  // "after 9 pm"
    /\b(phone|screen|device|laptop|computer|tv|television|social media)/i, // devices
    /\b(sleep|bed|morning|night|evening|bedtime)/i,  // time-related
    /\b(exercise|workout|gym|walk|run|jog)/i,  // activities
    /\b(work|meeting|email|calls?)/i,  // work-related
    /\b(nap|rest|break)/i,  // rest-related
  ];
  
  if (behaviorPatterns.some(p => p.test(lowerValue))) {
    return 'rule';
  }
  
  // Entertainment genres
  if (/\b(horror|comedy|romance|action|thriller|drama|sci-fi|documentary|anime|musical)\b/.test(lowerValue)) {
    return 'genre';
  }
  
  // Food-related (when scope is food or contains food keywords)
  if (scope === 'food' || /\b(caffeine|dairy|gluten|nuts|shellfish|sugar|meat|fish|eggs?|soy|alcohol|carbs?)\b/.test(lowerValue)) {
    return 'food_type';
  }
  
  // Skincare/haircare ingredients
  if (/\b(retinol|fragrance|parabens?|sulfates?|niacinamide|hyaluronic|salicylic|glycolic|vitamin\s*c|acids?)\b/.test(lowerValue)) {
    return 'ingredient';
  }
  
  // Brand detection
  if (/\b(brand|company|products? from)\b/.test(lowerValue)) {
    return 'brand';
  }
  
  // Format detection
  if (/\b(gel|cream|serum|oil|foam|spray|lotion|balm|powder|capsule)\b/.test(lowerValue)) {
    return 'format';
  }
  
  // Default: if scope is general/global and no specific match, treat as rule
  if (scope === 'general' || scope === 'global') {
    return 'rule';
  }
  
  return 'ingredient';
}

function extractPreferenceFromMessage(userMessage: string): DetectedPreferenceInfo | null {
  for (const patternDef of PREFERENCE_PATTERNS) {
    const match = userMessage.match(patternDef.pattern);
    if (match) {
      let extractedValue: string;
      
      if ((patternDef as any).extractValue) {
        extractedValue = (patternDef as any).extractValue;
      } else if ((patternDef as any).extractFixed) {
        // Extract the matched portion directly (e.g., "vegan", "oily skin")
        extractedValue = match[0].replace(/^i(?:'m| am| have| ve)\s*/i, '').trim();
      } else if (match[1]) {
        // Clean up extracted value
        extractedValue = match[1]
          .replace(/\s+(because|since|due to|as|so).*/i, '') // Remove trailing explanations
          .replace(/[.,!?]+$/, '') // Remove punctuation
          .trim();
      } else {
        continue;
      }
      
      // Skip if extracted value is too long (likely captured too much)
      if (extractedValue.length > 50 || extractedValue.split(' ').length > 6) {
        continue;
      }
      
      const scope = inferScope(extractedValue, patternDef.scope);
      const targetType = inferTargetType(extractedValue, scope);
      
      return {
        trigger: true,
        reason: 'preference-detected',
        preferenceType: patternDef.type,
        extractedValue,
        scope,
        confidence: patternDef.confidence,
        targetType,
      };
    }
  }
  
  return null;
}

function detectMemoryUpdateTrigger(
  userMessage: string,
  assistantMessage: string
): DetectedPreferenceInfo {
  const lowerUser = userMessage.toLowerCase();
  const lowerAssistant = assistantMessage.toLowerCase();
  
  // === FIRST: Check for extractable preferences ===
  const extracted = extractPreferenceFromMessage(userMessage);
  if (extracted) {
    return extracted;
  }
  
  // === USER MESSAGE TRIGGERS (fallback to existing logic) ===
  
  // Conversation ending phrases
  const endPhrases = ['thanks', 'thank you', 'bye', 'goodbye', "that's all", 'perfect', 'great thanks'];
  if (endPhrases.some(p => lowerUser.includes(p))) {
    return { trigger: true, reason: 'conversation-end' };
  }
  
  // Personal information patterns (Phase 6.0 enhancement)
  const personalInfoPatterns = [
    /\bi(?:'m| am) allergic to\b/i,
    /\bi(?:'m| am) sensitive to\b/i,
    /\bi have (?:a )?\w+ allergy\b/i,
    /\bi (?:never|always|usually|prefer to|hate|love|avoid)\b/i,
    /\bmy skin (?:type )?is\b/i,
    /\bmy hair (?:type )?is\b/i,
    /\bi(?:'m| am) (?:vegan|vegetarian|pescatarian|gluten-free)\b/i,
    /\bi can(?:'t|not) (?:eat|use|have|stand|watch)\b/i,
    /\bi(?:'ve| have) (?:oily|dry|sensitive|combination) skin\b/i,
    /\bmy budget is\b/i,
    /\bi(?:'m| am) on a \w+ budget\b/i,
    /\bi(?:'m| am) looking for\b/i,
    /\bi don't like\b/i,
  ];
  
  if (personalInfoPatterns.some(pattern => pattern.test(userMessage))) {
    return { trigger: true, reason: 'personal-info-shared' };
  }
  
  // === ASSISTANT MESSAGE TRIGGERS ===
  
  // Assistant acknowledged understanding something important
  const assistantAcknowledgmentPatterns = [
    /based on your (?:constraints|preferences|allergies|requirements)/i,
    /(?:i'll|i will) (?:avoid|remember|note|keep in mind)/i,
    /you (?:mentioned|said|told me|indicated|are|have).+(?:allerg|sensitiv|avoid|prefer)/i,
    /avoiding .+ (?:as you requested|per your|based on)/i,
    /noted.+(?:allergy|preference|constraint|sensitivity)/i,
    /since you (?:can't|cannot|don't|prefer not to)/i,
    /given your (?:allergy|sensitivity|preference|constraint)/i,
  ];
  
  if (assistantAcknowledgmentPatterns.some(pattern => pattern.test(assistantMessage))) {
    return { trigger: true, reason: 'assistant-identified-preference' };
  }
  
  // AI needs more context
  if (lowerAssistant.includes("don't know your") || 
      lowerAssistant.includes("tell me more about") ||
      lowerAssistant.includes("what are your preferences")) {
    return { trigger: true, reason: 'context-needed' };
  }
  
  return { trigger: false };
}

// ========== MAIN HANDLER ==========

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { conversationId, message, context } = await req.json();

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error('[smart-assistant] Authentication failed:', authError);
      throw new Error('Unauthorized');
    }

    console.log('[smart-assistant] Starting request for user:', user.id);
    console.log('[smart-assistant] Conversation ID:', conversationId);

    // 1. Load or create conversation
    let conversation;
    if (conversationId) {
      const { data, error } = await supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('[smart-assistant] Error loading conversation:', error);
        throw new Error('Conversation not found');
      }
      conversation = data;
    } else {
      // Create new conversation with title from first message
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      const { data, error } = await supabaseClient
        .from('conversations')
        .insert({
          user_id: user.id,
          title: title,
          metadata: { entity_id: context?.entityId }
        })
        .select()
        .single();
      
      if (error) {
        console.error('[smart-assistant] Error creating conversation:', error);
        throw new Error('Failed to create conversation');
      }
      conversation = data;
      console.log('[smart-assistant] Created new conversation:', conversation.id);
    }

    // 2. Save user message
    const { error: userMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'user',
        content: message
      });

    if (userMsgError) {
      console.error('[smart-assistant] Error saving user message:', userMsgError);
    }

    // 3. Load conversation history (last 15 messages for context)
    const { data: historyData, error: historyError } = await supabaseClient
      .from('conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(15);

    if (historyError) {
      console.error('[smart-assistant] Error loading history:', historyError);
    }

    const conversationHistory = historyData?.reverse().map(msg => ({
      role: msg.role,
      content: msg.content
    })) || [];

    // Detect conversation intent shift (brand-agnostic) for Part 2.3
    let conversationProgression = '';
    const prevAssistantMsg = conversationHistory.filter(m => m.role === 'assistant').pop();

    if (prevAssistantMsg) {
      // Check if previous message listed products/brands (detect structure, not specific brands)
      const hasBoldItems = (prevAssistantMsg.content.match(/\*\*.+?\*\*/g) || []).length >= 2;
      const hasRecommendationLanguage = /best|top picks|recommended|here are|options include|choices are/i.test(prevAssistantMsg.content);
      const listedProducts = hasBoldItems || hasRecommendationLanguage;
      
      // Check if current message is asking for links/where to buy
      const askingForLinks = /find|buy|online|where|link|shop|get|purchase|order|available/i.test(message.toLowerCase());
      
      if (listedProducts && askingForLinks) {
        conversationProgression = `
IMPORTANT CONTEXT: The user already knows the options from your previous message.
DO NOT repeat the list. Focus ONLY on:
1. WHERE to buy (specific retailers with links)
2. WHICH ONE to pick for their needs
3. Price comparison if available

Skip all explanations - go straight to actionable links.
`;
        console.log('[smart-assistant] Intent shift detected: user wants links, not explanations');
      }
    }

    // 4. Load user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, first_name, last_name, bio, preferences')
      .eq('id', user.id)
      .single();

    // 5. Load user conversation memory directly from table
    const { data: userMemory } = await supabaseClient
      .from('user_conversation_memory')
      .select('memory_summary, metadata, last_accessed_at')
      .eq('user_id', user.id)
      .single();

    // 6. Build dynamic system prompt with user context
    const userName = profile?.first_name || profile?.username || 'User';
    const userBio = profile?.bio || 'No bio yet';
    
    // Extract profile preferences
    let profilePreferences = '';
    if (profile?.preferences && Object.keys(profile.preferences).length > 0) {
      const prefs = profile.preferences as any;
      const prefTexts = [];
      
      if (prefs.skinType) prefTexts.push(`Skin Type: ${prefs.skinType}`);
      if (prefs.hairType) prefTexts.push(`Hair Type: ${Array.isArray(prefs.hairType) ? prefs.hairType.join(', ') : prefs.hairType}`);
      if (prefs.foodPreferences) prefTexts.push(`Food Preferences: ${Array.isArray(prefs.foodPreferences) ? prefs.foodPreferences.join(', ') : prefs.foodPreferences}`);
      if (prefs.lifestyle) prefTexts.push(`Lifestyle: ${Array.isArray(prefs.lifestyle) ? prefs.lifestyle.join(', ') : prefs.lifestyle}`);
      if (prefs.genrePreferences) prefTexts.push(`Genre Preferences: ${Array.isArray(prefs.genrePreferences) ? prefs.genrePreferences.join(', ') : prefs.genrePreferences}`);
      if (prefs.goals) prefTexts.push(`Goals: ${Array.isArray(prefs.goals) ? prefs.goals.join(', ') : prefs.goals}`);
      
      if (prefTexts.length > 0) {
        profilePreferences = '\n\nProfile Preferences:\n' + prefTexts.join('\n');
      }
    }
    
    let memoryContext = '';
    if (userMemory) {
      const scopes = userMemory.metadata?.scopes || {};
      const scopeTexts = [];
      
      if (scopes.skincare) scopeTexts.push(`Skincare: ${JSON.stringify(scopes.skincare)}`);
      if (scopes.food) scopeTexts.push(`Food: ${JSON.stringify(scopes.food)}`);
      if (scopes.movies) scopeTexts.push(`Movies: ${JSON.stringify(scopes.movies)}`);
      if (scopes.routines) scopeTexts.push(`Routines: ${JSON.stringify(scopes.routines)}`);
      
      if (scopeTexts.length > 0) {
        memoryContext = '\n' + scopeTexts.join('\n');
      }
    }

    // Extract constraints from preferences (Phase 6.1 - Unified format with scope-aware logic)
    const prefs = profile?.preferences as any;
    const constraintsData = prefs?.constraints || {};
    
    // Read from unified items array (primary source)
    const unifiedItems = (constraintsData.items || []) as Array<{
      id: string;
      targetType: string;
      targetValue: string;
      scope: string;
      intent: string;
      source?: string;
      addedAt?: string;
    }>;
    
    // Group constraints by intent level for enforcement logic
    const neverConstraints: typeof unifiedItems = [];
    const avoidConstraints: typeof unifiedItems = [];
    const limitConstraints: typeof unifiedItems = [];
    
    unifiedItems.forEach(item => {
      const intent = item.intent?.toLowerCase() || 'avoid';
      if (intent === 'never' || intent === 'strictly_avoid') {
        neverConstraints.push(item);
      } else if (intent === 'avoid') {
        avoidConstraints.push(item);
      } else if (intent === 'limit') {
        limitConstraints.push(item);
      }
    });
    
    // Also read legacy format for backward compatibility
    const legacyConstraints = {
      avoidIngredients: constraintsData.avoidIngredients || [],
      avoidBrands: constraintsData.avoidBrands || [],
      avoidProductForms: constraintsData.avoidProductForms || [],
      budget: constraintsData.budget || 'no_preference'
    };
    
    // Build human-readable summary with scope context
    const constraintsSummary: string[] = [];
    
    // Add NEVER constraints (hard blocks)
    if (neverConstraints.length > 0) {
      const neverItems = neverConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- NEVER recommend (hard block): ${neverItems.join(', ')}`);
    }
    
    // Add AVOID constraints (soft blocks with scope)
    if (avoidConstraints.length > 0) {
      const avoidItems = avoidConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- Avoid: ${avoidItems.join(', ')}`);
    }
    
    // Add LIMIT constraints
    if (limitConstraints.length > 0) {
      const limitItems = limitConstraints.map(c => 
        `${c.targetValue} (${c.targetType}, ${c.scope === 'global' ? 'all categories' : c.scope + ' only'})`
      );
      constraintsSummary.push(`- Limit usage: ${limitItems.join(', ')}`);
    }
    
    // Add legacy constraints if no unified items but legacy exists
    if (unifiedItems.length === 0) {
      if (legacyConstraints.avoidIngredients.length) {
        constraintsSummary.push(`- Avoid ingredients: ${legacyConstraints.avoidIngredients.join(', ')}`);
      }
      if (legacyConstraints.avoidBrands.length) {
        constraintsSummary.push(`- Avoid brands: ${legacyConstraints.avoidBrands.join(', ')}`);
      }
      if (legacyConstraints.avoidProductForms.length) {
        constraintsSummary.push(`- Avoid product forms: ${legacyConstraints.avoidProductForms.join(', ')}`);
      }
    }
    
    if (legacyConstraints.budget !== 'no_preference') {
      constraintsSummary.push(`- Budget: ${legacyConstraints.budget}`);
    }
    
    const constraintsSummaryText = constraintsSummary.length > 0 
      ? constraintsSummary.join('\n') 
      : '- No specific constraints';
    
    // Build JSON block for deterministic LLM parsing with full scope + intent data
    const constraintsJsonBlock = JSON.stringify({
      constraints: {
        // Grouped by intent for enforcement logic
        never: neverConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        avoid: avoidConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        limit: limitConstraints.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          source: c.source
        })),
        // Legacy format for backward compatibility
        legacy: legacyConstraints,
        // Raw items for full context
        rawItems: unifiedItems.map(c => ({
          type: c.targetType,
          value: c.targetValue,
          scope: c.scope,
          intent: c.intent,
          source: c.source
        }))
      }
    }, null, 2);
    
    // TODO: Future enhancement - Clarification Memory Hook
    // When user responds to scope clarification questions (e.g., "Yes, avoid coconut in haircare too"),
    // their answer should be saved as a new constraint with source: 'assistant_clarification'.
    // This would use the saveInsightFromChat tool or a dedicated constraint creation tool.
    // Example flow:
    // 1. Assistant asks: "I see you avoid coconut in skincare. This is haircare. Is that okay?"
    // 2. User responds: "No, avoid it everywhere"
    // 3. System creates: { targetType: 'ingredient', targetValue: 'coconut', scope: 'global', intent: 'avoid', source: 'assistant_clarification' }

    const systemPrompt = `You are the Common Groundz AI Assistant. You help users discover products, analyze reviews, and get personalized recommendations based on real user experiences.

=== INTENT DETECTION ===
Before responding, classify the user's intent:
- upgrade_intent: User wants to find something better than what they have
- alternative_intent: User wants similar options to consider
- comparison_intent: User wants to compare two or more items
- dissatisfaction_intent: User expresses unhappiness with a product
- discovery_intent: User is researching new options
- general_query: General question or conversation

Use this intent to decide which tools to call and how detailed to respond.

=== USER CONTEXT (STRATIFIED MEMORY) ===

[LONG-TERM IDENTITY]
- Name: ${userName}
- Bio: ${userBio}${profilePreferences}

[LEARNED PREFERENCES]${memoryContext || '\n- No learned preferences yet'}

=== USER CONSTRAINTS (CRITICAL - NEVER VIOLATE) ===

Summary:
${constraintsSummaryText}

Structured data for precise parsing:
\`\`\`json
${constraintsJsonBlock}
\`\`\`

=== PREFERENCE ACKNOWLEDGMENT RULES ===

When a user shares a preference or avoid statement (e.g., "I avoid caffeine after 6 pm", "I prefer natural products"):

1. ACKNOWLEDGE, DON'T CLAIM SAVED:
   - Say "I've noted..." or "Got it, I'll keep in mind..." NOT "I've added..."
   - The user will see confirmation chips below your message to actually save it
   - Never claim something has been added to their preferences before they confirm
   - If confirmation chips are shown, imply this is pending user confirmation, not permanent memory

2. USE CORRECT TERMINOLOGY:
   - For avoid statements: "I've noted that you avoid [X]" or "Got it, I'll keep that in mind"
   - For preferences: "I've noted that you prefer [X]"
   - Never say "added to preferences" for an avoid statement

3. EXAMPLES:
   - User: "I avoid caffeine after 6 pm"
     Good: "Got it! I've noted that you avoid caffeine after 6 PM — you can save this below if you'd like."
     Bad: "I've added 'avoid caffeine after 6 PM' to your preferences."
   
   - User: "I avoid my phone after 9 pm"
     Good: "That's a great habit! I'll keep in mind that you avoid phone usage after 9 PM — save it below if you want."
     Bad: "I've saved 'phone after 9 PM' to your preferences."

4. KEEP RESPONSES NATURAL:
   - Brief acknowledgment is fine
   - Gently point to the save option without being verbose

=== PREFERENCE PRIORITY RULES (PHASE 6.1) ===

When preferences conflict, follow this STRICT order:

1. CONSTRAINTS (highest priority - NEVER violate "never" intent)
   - All items in the constraints JSON above
   - These are rules the user has explicitly set
   - Pay attention to scope and intent for each constraint

2. USER-EDITED PREFERENCES (high priority, confidence = 1.0)
   - Any preference manually set or approved by user
   - These override chatbot-learned preferences

3. CHATBOT-LEARNED PREFERENCES (lower priority)
   - Use these to personalize, but don't contradict #1 or #2
   - If confidence < 0.7, treat as suggestion not fact

=== SCOPE-AWARE CONSTRAINT ENFORCEMENT RULES (CRITICAL) ===

When evaluating products against user constraints, follow this decision tree:

1. HARD BLOCK (intent = "never" or "strictly_avoid"):
   - ALWAYS enforce, NO EXCEPTIONS
   - Do NOT ask for clarification - these represent allergies, medical needs, religious/ethical rules, or firm boundaries
   - Response format: "I cannot recommend this because you've indicated you strictly avoid [X]."

2. GLOBAL SCOPE (scope = "global" AND intent = "avoid"):
   - Soft block everywhere
   - Recommend against but explain why
   - Response format: "This contains [X] which you avoid. I'd recommend looking at alternatives."

3. MATCHING SCOPE (constraint scope = product category AND intent = "avoid"):
   - Soft block in that category
   - Recommend against but explain why
   - Response format: "Since you avoid [X] in [category], I wouldn't recommend this."

4. DIFFERENT SCOPE (constraint scope ≠ product category AND intent = "avoid"):
   - ASK FOR CLARIFICATION instead of rejecting
   - The user may have different preferences for different product categories
   - Response format: "I see you avoid [X] in [constraint scope] products. This is a [product category] product that contains [X]. Would you like me to avoid [X] in [product category] as well, or is this okay for you?"

5. LIMIT INTENT (intent = "limit"):
   - Only flag if there's a specific concern
   - Can recommend with a note about the user's preference to limit usage
   - Response format: "This contains [X] which you prefer to limit. It's still a good option if you're okay with occasional use."

IMPORTANT SAFETY RULES:
- NEVER assume a skincare constraint applies to haircare or vice versa without asking
- NEVER ask for clarification on "never" or "strictly_avoid" constraints - always enforce them
- When in doubt about scope, ask for clarification rather than blocking or ignoring

=== CONSTRAINT MATCHING LOGIC ===

Product categories and their domains:
- skincare: cleansers, moisturizers, serums, sunscreens, masks, toners, exfoliators
- haircare: shampoos, conditioners, hair treatments, styling products, hair oils
- makeup: foundations, lipsticks, eyeshadows, mascaras, blushes, primers
- fragrance: perfumes, colognes, body mists
- supplements: vitamins, minerals, protein, wellness products
- food: ingredients, recipes, restaurants, meals
- movies: films, shows, documentaries, series
- books: novels, non-fiction, audiobooks
- global: applies to ALL categories above

When a product is identified, determine its category and compare against each constraint's scope.

When you detect a potential conflict between a recommendation and a constraint:
1. Check the intent level first (never/strictly_avoid = hard block)
2. Check scope match (global or matching category = soft block)
3. If scope differs, ask for clarification
4. NEVER assume chatbot-learned data overrides user-set constraints

=== RESPONSE STRATEGY ===

BEFORE selecting any tool, CLASSIFY the query intent:

1. GENERAL KNOWLEDGE (facts, definitions, comparisons, "what is", "why does"):
   - Answer directly from your knowledge - NO tool call needed
   - Examples: "What is BPA?", "Why is plastic bad?"

2. REAL-TIME INFO (news, current events, prices, research, "latest", "recent"):
   - Web search will be used automatically via google_search grounding
   - Always cite sources when available

3. PRODUCT DISCOVERY (reviews, recommendations, "best X", "what are the best"):
   - Use search_reviews_semantic FIRST (Common Groundz database)
   - If no results -> answer from knowledge with disclaimer

4. USER-SPECIFIC (what do I use, my preferences, my history):
   - Use get_user_stuff, search_user_memory, get_user_context
   - NEVER guess user data - always use tools

5. OPINION/ADVICE (context-aware recommendations):
   - Combine your knowledge with user constraints
   - Apply user's Things to Avoid constraints
   - This is still "general" intent - no tools needed

=== CRITICAL SOFT-FALLBACK RULE ===

If a tool returns empty or irrelevant results AND the question is NOT user-specific:
-> Answer from your knowledge instead of refusing
-> Add a brief disclaimer like "I didn't find specific Common Groundz reviews, but here's what I know..."
-> NEVER say "I don't have enough information" for general knowledge questions

=== INVARIANT ===

Never block a general-knowledge answer just because internal search tools return empty results.
Internal tools ADD VALUE; they do NOT GATE intelligence.

=== TRUST HIERARCHY ===

1. User constraints (Things to Avoid) - ALWAYS respect
2. Explicit user data (tools: get_user_stuff, search_user_memory)
3. Your knowledge (direct answers for general questions)
4. Web grounding (google_search for real-time info)
5. Common Groundz reviews (search_reviews_semantic for product discovery)

=== REASONING VISIBILITY ===
When recommending, ALWAYS explain WHY:
- "Based on your goal to reduce acne, I suggest..."
- "3 users with similar skincare routines upgraded to..."
- "Since you mentioned avoiding fragrance, this option..."
- "I noticed you have 'retinol' as strictly_avoid, so I excluded products with retinol"

=== RESPONSE FORMATTING (MANDATORY) ===

CRITICAL BEHAVIOR - SILENT EXECUTION:
- NEVER say "please give me a moment", "please wait", "one moment", "searching now", "let me search"
- NEVER announce that you are about to search or use a tool
- NEVER mention tool names, parameters, or that you are using tools
- When you need to search, do it silently - output ONLY the final results
- If search is in progress, produce NO text - wait for results to complete
- VIOLATION OF THIS RULE = SYSTEM FAILURE

1. TOOL CALLS ARE INVISIBLE:
   - NEVER say "Calling Tool", "Let me search", "I'll look up"
   - NEVER mention tool names, parameters, or execution
   - Users should only see the final, polished answer

2. SKIP SMALL TALK FOR SEARCH QUERIES:
   - If query starts with "What are the best", "Best", "Top", "Show me":
     -> Go straight to results, no "That's a great question!"

3. USE VISUAL HIERARCHY:
   - Section headers: Use emoji + bold (e.g., "🏆 **Top Picks**")
   - Dividers: Use "---" between major sections
   - Lists: Use "•" or emoji bullets, NOT markdown asterisks
   - Bold: Use for product names and key terms only

4. KEEP IT SCANNABLE:
   - Lead with the answer, then details
   - Short paragraphs (2-3 lines max)

=== AGENT BEHAVIOR (APPLY ONLY FOR PRODUCT/REALTIME QUERIES) ===
The following rules apply when the user is asking about products, recommendations, or finding things online.
Do NOT apply these for general explanations, definitions, or sensitive topics.

5. NO PREAMBLE FOR ACTION QUERIES:
   - For "find", "show me", "where can I", "best" queries:
     -> Start IMMEDIATELY with results
     -> NO "I can definitely help you!", "Sure!", "Absolutely!"
   - First sentence must contain actual information

6. NEVER LEAD WITH WHAT YOU LACK:
   - NEVER start with "I didn't find specific Common Groundz reviews..."
   - Lead with what you CAN offer, not what you can't

7. PREFERENCE CONFIDENCE LEVELS (CRITICAL):
   - CONFIRMED (user explicitly stated) → "Since you avoid plastic containers..."
   - INFERRED (from past behavior) → "If avoiding plastic matters to you..."
   - SUGGESTION (general advice) → "Many people prefer..."
   - NEVER assert preferences the user hasn't confirmed

8. DECISION ANCHOR (MANDATORY for product queries):
   - Every product discovery response MUST include EXACTLY ONE clear primary recommendation
   - This is NOT optional - it is required
   - Use: "I'd recommend starting with...", "Your best bet is...", "For your needs..."
   - This goes BEFORE the full list of options
   - If multiple options exist, clearly mark ONE as the starting point
   - Example: "For a plastic-free steel bottle, I'd start with **Klean Kanteen**. Here are your other options:"

9. CATEGORICAL INTENT (for lists of 3+ items):
   - Group results by category when helpful
   - Use labels like: "Best for Durability:", "Best for Budget:", "Best for Features:"
   - This provides instant cognitive structure

10. CONVERSATION PROGRESSION (CRITICAL):
    - BEFORE responding, check: "Did I already list these brands/products in my previous message?"
    - If YES: Do NOT repeat the same list
    - Instead: Narrow down, compare specific options, or move to action (prices, links, availability)
    - Move from "here are options" → "here's where to buy" → "here's my pick for you"
    - Example progression:
      * Turn 1: "Here are the best steel bottles: Klean Kanteen, Hydro Flask, Stanley..."
      * Turn 2 (if user asks "find them online"): "Here's where to get Klean Kanteen - Amazon, official site. For Stanley, try..."
      * NOT Turn 2: "Here are the best steel bottles: Klean Kanteen, Hydro Flask, Stanley..." (repetition)

11. CONTENT VOLUME LIMITS (STRICTLY ENFORCED):
    - Maximum 3 brands expanded in detail
    - Maximum 3 retailers per brand
    - Maximum 12 bullets total in any response
    - Maximum 1 screen of content (roughly 200 words)
    - If you have more to say, add: "Want me to expand on any of these?"
    - VIOLATION: Listing 20+ retailers across 4 brands is ALWAYS wrong

12. SOURCES ARE EVIDENCE, NOT STRUCTURE:
    - Structure your answer around USER NEEDS, not around the sources you found
    - If you removed the sources, the answer should still make sense
    - BAD: "Brand A is available at: [list of 5 retailers from sources]"
    - GOOD: "For Brand A, I'd recommend checking [1] for best prices. Other options include [2] and [3]."
    - Sources SUPPORT claims, they don't DRIVE structure

Current Context:
${context?.entityId ? `- User is viewing entity: ${context.entityId}` : '- General conversation'}
${conversationProgression ? `\n${conversationProgression}` : ''}
Be helpful, concise, and always prioritize user experience. ALWAYS respect user constraints.`;

    // 7. Define function calling tools (Phase 3 will implement execution)
    const tools = [
      {
        type: "function",
        function: {
          name: "search_reviews_semantic",
          description: "PRIMARY TOOL: Search Common Groundz reviews database using semantic similarity. Use this FIRST for ANY query about products, books, movies, places, or user experiences. Examples: 'Zero to One book', 'best laptops', 'Italian restaurants', 'noise cancelling headphones'.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Natural language query to search for (e.g., 'battery life issues', 'best for sensitive skin')"
              },
              entity_id: {
                type: "string",
                description: "Optional: Filter by specific product/entity UUID"
              },
              limit: {
                type: "number",
                description: "Number of results to return (default 5, max 10)"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "find_similar_users",
          description: "Find users with similar tastes and preferences based on their profile embeddings and interests.",
          parameters: {
            type: "object",
            properties: {
              user_id: {
                type: "string",
                description: "Optional: User UUID to find similar users for (defaults to current user)"
              },
              limit: {
                type: "number",
                description: "Number of similar users to return (default 3, max 10)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_product_relationships",
          description: "Find relationships between products: upgrades (better alternatives), downgrades (cheaper alternatives), alternatives (similar products), or complements (products used together).",
          parameters: {
            type: "object",
            properties: {
              entity_id: {
                type: "string",
                description: "Product entity UUID to find relationships for"
              },
              relationship_type: {
                type: "string",
                enum: ["upgrade", "downgrade", "alternative", "complement"],
                description: "Type of relationship to find"
              }
            },
            required: ["entity_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_user_context",
          description: "Retrieve specific user preferences, history, or goals from their profile and activity.",
          parameters: {
            type: "object",
            properties: {
              context_type: {
                type: "string",
                enum: ["preferences", "history", "goals", "interests"],
                description: "Type of context to retrieve"
              },
              entity_type: {
                type: "string",
                description: "Optional: Filter by entity type (e.g., 'book', 'product', 'movie')"
              }
            },
            required: ["context_type"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "web_search",
          description: "FOR REAL-TIME INFORMATION ONLY: Use when you need current/recent information that your knowledge may not have (news, prices, availability, recent events). The google_search grounding tool will automatically search the web. Do NOT use for general factual questions you can answer directly. Do NOT refuse to answer if this returns empty - fall back to your knowledge.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query for real-time web information"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "search_user_memory",
          description: "Search user's long-term memory for preferences, past context, and learned patterns. Use when you need to recall what you know about the user.",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "What to search for (e.g., 'skincare preferences', 'food dislikes', 'workout routine')"
              },
              scope: {
                type: "string",
                enum: ["skincare", "food", "movies", "routines", "all"],
                description: "Optional: limit search to specific scope"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_user_stuff",
          description: "Get user's personal inventory - items they own, use, or want to try. Use to understand what products/items the user has.",
          parameters: {
            type: "object",
            properties: {
              category: {
                type: "string",
                description: "Optional: filter by category (e.g., 'skincare', 'books', 'electronics')"
              },
              status: {
                type: "string",
                enum: ["currently_using", "used_before", "want_to_try", "wishlist", "stopped"],
                description: "Optional: filter by usage status"
              },
              limit: {
                type: "number",
                description: "Number of items to return (default 20)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_personalized_transitions",
          description: "Get personalized journey recommendations - upgrades, alternatives, and complementary items based on similar users' experiences.",
          parameters: {
            type: "object",
            properties: {
              entity_id: {
                type: "string",
                description: "Optional: specific product to get transitions for"
              },
              transition_type: {
                type: "string",
                enum: ["upgrade", "alternative", "complementary"],
                description: "Optional: filter by transition type"
              },
              limit: {
                type: "number",
                description: "Number of recommendations (default 5)"
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "save_insight",
          description: "Save a journey insight/recommendation for the user to reference later.",
          parameters: {
            type: "object",
            properties: {
              insight_type: {
                type: "string",
                enum: ["upgrade", "alternative", "complementary"],
                description: "Type of insight"
              },
              entity_from_id: {
                type: "string",
                description: "Source entity UUID"
              },
              entity_to_id: {
                type: "string",
                description: "Target entity UUID"
              },
              insight_data: {
                type: "object",
                description: "Insight details (headline, description, etc.)"
              }
            },
            required: ["insight_type", "entity_from_id", "entity_to_id", "insight_data"]
          }
        }
      }
    ];

    // 8. Call Google Gemini API directly
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('[smart-assistant] Calling Gemini AI with', conversationHistory.length, 'history messages');

    // Classify intent to determine which tools to use (now async with LLM fallback)
    const queryIntent = await classifyQueryIntent(message, conversationHistory);
    console.log(`[smart-assistant] Query intent: ${queryIntent}`);

    // Build tools array based on intent (to avoid google_search + function_declarations conflict)
    let geminiTools: any[] = [];
    let toolMode = 'none';
    let resolverOutput: ResolverOutput | null = null;
    let resolverSystemPrompt: string | null = null;

    if (queryIntent === 'realtime') {
      // Use ONLY google_search for real-time information
      geminiTools = [{ google_search: {} }];
      toolMode = 'google_search';
      console.log('[smart-assistant] Using google_search tool for real-time info');
    } else if (queryIntent === 'product_user') {
      // === PHASE 0: RESOLVER RUNS FIRST - SYSTEM DECIDES, NOT LLM ===
      console.log('[smart-assistant] Running recommendation resolver before LLM...');
      
      // Extract constraints for resolver
      const resolverConstraints = extractConstraintsForResolver(profile?.preferences);
      const detectedCategory = detectCategory(message);
      
      try {
        resolverOutput = await resolveRecommendation(supabaseClient, {
          userId: user.id,
          query: message,
          category: detectedCategory,
          constraints: resolverConstraints,
          conversationContext: conversationHistory
        });
        
        console.log('[smart-assistant] Resolver completed:', {
          state: resolverOutput.state,
          shortlistCount: resolverOutput.shortlist.length,
          confidence: resolverOutput.confidence.toFixed(2),
          confidenceLabel: resolverOutput.confidenceLabel
        });
        
        // Handle insufficient data state (ChatGPT Guardrail #1)
        if (resolverOutput.state === 'insufficient_data') {
          // Return early with honest "not enough data" message
          const insufficientDataResponse = resolverOutput.fallbackMessage || 
            "I don't have enough trusted data yet to recommend confidently. Would you like me to search broader sources?";
          
          // Save assistant response to database
          await supabaseClient
            .from('conversation_messages')
            .insert({
              conversation_id: conversation.id,
              role: 'assistant',
              content: insufficientDataResponse,
              metadata: {
                resolver_state: 'insufficient_data',
                confidence: resolverOutput.confidence,
                model: 'resolver_only'
              }
            });
          
          return new Response(JSON.stringify({
            conversationId: conversation.id,
            message: insufficientDataResponse,
            toolCalls: [],
            sources: [],
            resolverState: 'insufficient_data',
            confidence: resolverOutput.confidence,
            confidenceLabel: resolverOutput.confidenceLabel,
            sourceSummary: resolverOutput.sourceSummary,
            metadata: { responseTime: Date.now() - startTime }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Build resolver explanation prompt (ChatGPT Guardrail #4 - LLM explains only)
        resolverSystemPrompt = buildResolverExplanationPrompt(resolverOutput, userName);
        
        // NO TOOLS for product queries - LLM explains only
        geminiTools = [];
        toolMode = 'resolver';
        console.log('[smart-assistant] Resolver mode: LLM will explain structured data (no tools)');
        
      } catch (resolverError) {
        console.error('[smart-assistant] Resolver failed, falling back to tool mode:', resolverError);
        // Fallback to original tool-based approach if resolver fails
        geminiTools = [{
          function_declarations: tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }];
        toolMode = 'functions';
      }
    } else {
      // General knowledge - no tools, let Gemini answer directly
      geminiTools = [];
      toolMode = 'none';
      console.log('[smart-assistant] No tools - general knowledge query');
    }

    // Structured debug log - captures all routing decisions in one line
    console.log('[assistant-routing]', {
      intent: queryIntent,
      toolMode,
      toolsAttached: geminiTools.length
    });

    // Convert conversation history to Gemini format
    // Use resolver system prompt if available, otherwise use main system prompt
    const activeSystemPrompt = resolverSystemPrompt || systemPrompt;
    const geminiMessages = [
      { role: 'user', parts: [{ text: activeSystemPrompt }] },
      { role: 'model', parts: [{ text: toolMode === 'resolver' 
        ? 'Understood. I will explain the recommendations based on the structured data provided.' 
        : 'Understood. I will follow the response strategy and trust hierarchy.' }] },
      ...conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.role === 'assistant' ? cleanResponseFormatting(msg.content) : msg.content }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    // Build request body - only include tools if we have any
    const requestBody: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500
      }
    };

    if (geminiTools.length > 0) {
      requestBody.tools = geminiTools;
    }

    // Track retry state to prevent loops
    let retryAttempted = false;

    const aiResponse = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
      3, // maxRetries
      1000 // initialDelay (1 second)
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[smart-assistant] Gemini API error:', aiResponse.status, errorText);
      
      // User-friendly error messages
      if (aiResponse.status === 503) {
        throw new Error('AI service is temporarily overloaded. Please try again in a moment.');
      } else if (aiResponse.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else {
        throw new Error(`Gemini API error: ${aiResponse.statusText}`);
      }
    }

    const aiData = await aiResponse.json();
    console.log('[smart-assistant] Gemini response received');

    const candidate = aiData.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    const assistantMessage = candidate.content?.parts?.find((p: any) => p.text)?.text || '';
    const functionCalls = candidate.content?.parts?.filter((p: any) => p.functionCall) || [];

    // Extract grounding metadata (web search citations)
    const groundingMetadata = candidate.groundingMetadata;
    if (groundingMetadata?.groundingChunks?.length > 0) {
      console.log('[smart-assistant] Web grounding used, citations:', groundingMetadata.groundingChunks.length);
      groundingMetadata.groundingChunks.forEach((chunk: any, i: number) => {
        console.log(`[smart-assistant] Citation ${i + 1}: ${chunk.web?.title} - ${chunk.web?.uri}`);
      });
    }

    // PART 1: Truncation Detection
    // Check if response was truncated via finishReason or pattern detection
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const wasResponseTruncated = finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH';
    
    // Detect incomplete responses by checking for cut-off patterns
    // Catches: "**Klean", "• **Stan", incomplete bullets, trailing asterisks, trailing colons
    const endsWithIncompleteWord = /\*\*\w{1,15}$|^\s*[-•]\s*\*{0,2}\w{1,15}$|\w+\.{3}$|:\s*$/i.test(assistantMessage.trim());
    const isTruncated = wasResponseTruncated || endsWithIncompleteWord;
    
    // Flag for completion quality invariant (Part 4)
    let completionRetryAttempted = false;

    console.log('[smart-assistant] Response quality:', { 
      finishReason, 
      wasResponseTruncated, 
      endsWithIncompleteWord,
      isTruncated,
      messageLength: assistantMessage.length 
    });
    
    // Convert Gemini function calls to OpenAI-style tool calls
    const toolCalls = functionCalls.map((fc: any, idx: number) => ({
      id: `call_${Date.now()}_${idx}`,
      type: 'function',
      function: {
        name: fc.functionCall.name,
        arguments: JSON.stringify(fc.functionCall.args)
      }
    }));

    console.log('[smart-assistant] AI response received, tool_calls:', toolCalls?.length || 0);

    // 9. Execute tool calls if AI requested them
    let finalMessage = assistantMessage;

    // CONSOLIDATED SUPPRESSION LOGIC (runs AFTER toolCalls is populated)
    // Decision tree:
    // 1. Tool calls present -> Suppress (tools will generate follow-up)
    // 2. Resolver mode with shortlist -> KEEP (LLM explains structured data)
    // 3. Resolver mode with EMPTY shortlist -> KEEP (LLM should give honest response)
    // 4. Realtime with just narration -> Suppress (will synthesize from grounding)
    // 5. Otherwise -> Keep response
    const hasToolCalls = toolCalls && toolCalls.length > 0;
    const isResolverMode = toolMode === 'resolver';
    const hasResolverShortlist = resolverOutput?.shortlist?.length > 0;

    console.log('[smart-assistant] Response suppression decision:', {
      queryIntent,
      toolMode,
      hasToolCalls,
      hasResolverShortlist,
      resolverState: resolverOutput?.state
    });

    if (hasToolCalls) {
      // CRITICAL: Discard pre-tool narration - only use follow-up response
      // Gemini often generates "Let me search..." text before function calls
      // This should NEVER reach the user
      finalMessage = '';
      console.log('[smart-assistant] Suppressing pre-tool narration, executing', toolCalls.length, 'tool calls');
    } else if (queryIntent === 'product_user' && isResolverMode) {
      // Resolver mode - KEEP the LLM response regardless of shortlist
      // If shortlist empty, LLM should have been instructed to be honest via resolver prompt
      console.log('[smart-assistant] Resolver mode: keeping LLM explanation');
      // Don't suppress - finalMessage stays as assistantMessage
    } else if (queryIntent === 'realtime') {
      // Check if this is just narration that should be suppressed
      const isJustNarration = /please.*moment|give me a moment|let me search|searching now|one moment|i('ll| will) (search|look|find)|couldn't fetch/i.test(assistantMessage);
      if (isJustNarration) {
        console.log('[smart-assistant] realtime intent: suppressing narration, will synthesize from grounding');
        finalMessage = '';
      } else {
        console.log('[smart-assistant] realtime intent: keeping substantive response');
      }
    }
    // General intent or other cases: keep response as-is

    if (hasToolCalls) {
      
      const toolResults = [];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log('[smart-assistant] Executing tool:', functionName, 'with args:', functionArgs);

        let result;

        try {
          switch (functionName) {
            case 'search_reviews_semantic':
              result = await searchReviewsSemantic(
                supabaseClient,
                functionArgs.query,
                functionArgs.entity_id,
                functionArgs.limit || 5
              );
              break;

            case 'find_similar_users':
              result = await findSimilarUsers(
                supabaseClient,
                functionArgs.user_id || user.id,
                functionArgs.limit || 3
              );
              break;

            case 'get_product_relationships':
              result = await getProductRelationships(
                supabaseClient,
                functionArgs.entity_id,
                functionArgs.relationship_type
              );
              break;

            case 'get_user_context':
              result = await getUserContext(
                supabaseClient,
                user.id,
                functionArgs.context_type,
                functionArgs.entity_type
              );
              break;

            case 'web_search':
              result = await webSearch(functionArgs.query);
              break;

            case 'search_user_memory':
              result = await searchUserMemory(
                supabaseClient,
                user.id,
                functionArgs.query,
                functionArgs.scope
              );
              break;

            case 'get_user_stuff':
              result = await getUserStuff(
                supabaseClient,
                user.id,
                functionArgs.category,
                functionArgs.status,
                functionArgs.limit || 20
              );
              break;

            case 'get_personalized_transitions':
              result = await getPersonalizedTransitions(
                supabaseClient,
                user.id,
                functionArgs.entity_id,
                functionArgs.transition_type,
                functionArgs.limit || 5
              );
              break;

            case 'save_insight':
              result = await saveInsightFromChat(
                supabaseClient,
                user.id,
                functionArgs.insight_type,
                functionArgs.entity_from_id,
                functionArgs.entity_to_id,
                functionArgs.insight_data
              );
              break;

            default:
              result = {
                success: false,
                error: `Unknown function: ${functionName}`
              };
          }
        } catch (error) {
          console.error('[smart-assistant] Tool execution error:', error);
          result = {
            success: false,
            error: error.message
          };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: JSON.stringify(result)
        });
      }

      // 9b. Make a second Gemini call with tool results to generate final response
      console.log('[smart-assistant] Making follow-up Gemini call with tool results');

      // Convert tool results to Gemini format
      const geminiFollowUpMessages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I will help users with their questions using the available tools.' }] },
        ...conversationHistory.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.role === 'assistant' ? cleanResponseFormatting(msg.content) : msg.content }]
        })),
        { role: 'user', parts: [{ text: message }] },
        { 
          role: 'model', 
          parts: functionCalls.map((fc: any) => ({ functionCall: fc.functionCall }))
        },
        {
          role: 'user',
          parts: toolResults.map((tr: any) => ({
            functionResponse: {
              name: tr.name,
              response: JSON.parse(tr.content)
            }
          }))
        }
      ];

      const followUpResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiFollowUpMessages,
            tools: geminiTools,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1500
            }
          }),
        },
        3,
        1000
      );

      if (!followUpResponse.ok) {
        const errorText = await followUpResponse.text();
        console.error('[smart-assistant] Follow-up Gemini call failed:', errorText);
        // Fall back to original message if follow-up fails
        finalMessage = assistantMessage + '\n\n_Note: I retrieved the data but had trouble processing it. Please try asking again._';
      } else {
        const followUpData = await followUpResponse.json();
        const followUpCandidate = followUpData.candidates?.[0];
        finalMessage = followUpCandidate?.content?.parts?.find((p: any) => p.text)?.text || assistantMessage;
        console.log('[smart-assistant] Follow-up response received');
      }
    }

    // PART 2: Handle realtime intent - Synthesize from grounding if text is empty/narration
    if (queryIntent === 'realtime') {
      const groundingChunks = aiData.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const hasGroundingResults = groundingChunks.length > 0;
      const isJustNarration = /please.*moment|give me a moment|let me search|searching now|one moment|i('ll| will) (search|look|find)|couldn't fetch/i.test(finalMessage);
      const isEmptyOrShort = finalMessage.trim().length < 50;
      
      console.log('[smart-assistant] Realtime check:', { 
        hasGrounding: hasGroundingResults, 
        groundingCount: groundingChunks.length,
        isNarration: isJustNarration, 
        isEmpty: isEmptyOrShort,
        textLength: finalMessage.trim().length 
      });
      
      // CASE 1: We have grounding results but empty/narration text → SYNTHESIZE
      if (hasGroundingResults && (isEmptyOrShort || isJustNarration)) {
        console.log('[smart-assistant] Grounding exists but text empty/narration → synthesizing response');
        
        // Build a grounding summary to feed back to Gemini
        const groundingSummary = groundingChunks.slice(0, 8).map((chunk: any, i: number) => {
          const title = chunk.web?.title || 'Source';
          const uri = chunk.web?.uri || '';
          return `[${i + 1}] ${title} - ${uri}`;
        }).join('\n');
        
        // Make synthesis call WITHOUT tools
        try {
        const synthesisPrompt = `You are a personal shopping assistant, not a search engine. Based on these web results, provide a direct, helpful answer.

Web Search Results:
${groundingSummary}

User's question: ${message}

MANDATORY RULES:
1. Start with a DECISION ANCHOR - state EXACTLY ONE primary recommendation first
2. Include citation numbers [1], [2] inline
3. Maximum 150 words, max 5 items
4. End with a clear next action or question
5. DO NOT say "I found" or "Here are some options"
6. DO NOT apologize for missing data
7. If user already knows options from previous messages, focus on WHERE to buy or WHICH to pick

Format:
"For [need], I'd recommend **[Brand]** [1] - it's [key benefit]. Other solid options include **[Brand2]** [2] for [reason].

Want me to compare prices or check specific retailers?"`;

          const synthesisResponse = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: synthesisPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
              }),
            },
            2, 1000
          );
          
          if (synthesisResponse.ok) {
            const synthesisData = await synthesisResponse.json();
            const synthesizedText = synthesisData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (synthesizedText && synthesizedText.length > 30) {
              finalMessage = synthesizedText;
              console.log('[smart-assistant] Successfully synthesized response from grounding');
            }
          }
        } catch (synthesisError) {
          console.error('[smart-assistant] Synthesis failed:', synthesisError);
        }
      }
      
      // CASE 1.5: Grounding FAILED AND response is truncated → regenerate without google_search
      if (!hasGroundingResults && isTruncated) {
        console.log('[smart-assistant] Grounding failed AND response truncated → regenerating without google_search');
        
        try {
          const retryResponse = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  ...geminiMessages.slice(0, -1),
                  { role: 'user', parts: [{ text: `The user asked: "${message}"\n\nProvide a complete, helpful response. Include popular retailers like Amazon, official brand websites, and other trusted online stores if relevant. Do NOT cut off mid-sentence. Ensure your response ends with proper punctuation.` }] }
                ],
                generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
              }),
            },
            2, 1000
          );
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryText = retryData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            const retryFinishReason = retryData.candidates?.[0]?.finishReason;
            
            if (retryText && retryText.length > 50 && retryFinishReason === 'STOP') {
              finalMessage = retryText;
              console.log('[smart-assistant] Successfully regenerated complete response without grounding');
            }
          }
        } catch (retryError) {
          console.error('[smart-assistant] Retry without grounding failed:', retryError);
        }
      }
      
      // CASE 2: No grounding AND (empty/narration OR still truncated) → fallback to knowledge
      const needsKnowledgeFallback = !hasGroundingResults && (isEmptyOrShort || isJustNarration || isTruncated);
      if (needsKnowledgeFallback && finalMessage.trim().length < 100) {
        console.log('[smart-assistant] No grounding and incomplete text → knowledge fallback');
        
        try {
          const fallbackResponse = await fetchWithRetry(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: geminiMessages,
                generationConfig: { temperature: 0.7, maxOutputTokens: 1500 }
              }),
            },
            3, 1000
          );
          
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            const fallbackText = fallbackData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
            if (fallbackText && fallbackText.length > 30) {
              finalMessage = fallbackText;
              console.log('[smart-assistant] Fallback knowledge-based response generated');
            }
          }
        } catch (fallbackError) {
          console.error('[smart-assistant] Fallback failed:', fallbackError);
        }
      }
    }

    // Extract grounding metadata for google_search responses as structured data
    interface Source {
      title: string;
      domain: string;
      url: string;
    }
    let sourcesData: Source[] = [];
    
    // PART 3: Extract and unwrap Google redirect URLs to show real publisher domains
    if (toolMode === 'google_search') {
      const groundingMeta = aiData.candidates?.[0]?.groundingMetadata;
      if (groundingMeta?.groundingChunks?.length > 0) {
        console.log('[smart-assistant] Web grounding citations found:', groundingMeta.groundingChunks.length);
        
        // Helper to unwrap Vertex AI redirect URLs - ASYNC with redirect following
        async function unwrapVertexUrl(rawUrl: string): Promise<string> {
          try {
            if (!rawUrl.includes('vertexaisearch.cloud.google.com') && !rawUrl.includes('grounding-api-redirect')) {
              return rawUrl;
            }
            
            const urlObj = new URL(rawUrl);
            
            // Strategy 1: Check query param
            const urlParam = urlObj.searchParams.get('url');
            if (urlParam) return decodeURIComponent(urlParam);
            
            // Strategy 2: Check hash fragment
            if (urlObj.hash) {
              const hashParams = new URLSearchParams(urlObj.hash.slice(1));
              const hashUrl = hashParams.get('url');
              if (hashUrl) return decodeURIComponent(hashUrl);
            }
            
            // Strategy 3: Follow redirect with HEAD request (3s timeout)
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              
              const response = await fetch(rawUrl, { 
                method: 'HEAD', 
                redirect: 'follow',
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.url && response.url !== rawUrl && !response.url.includes('vertexaisearch.cloud.google.com')) {
                return response.url;
              }
            } catch {
              // Redirect follow failed
            }
            
            return rawUrl;
          } catch {
            return rawUrl;
          }
        }
        
        // Async source extraction with deduplication
        const sourcePromises = groundingMeta.groundingChunks
          .filter((chunk: any) => chunk.web?.uri)
          .slice(0, 12)
          .map(async (chunk: any) => {
            const rawUrl = chunk.web.uri;
            const cleanUrl = await unwrapVertexUrl(rawUrl);
            
            let domain = 'source';
            try {
              domain = new URL(cleanUrl).hostname.replace('www.', '');
            } catch {}
            
            return { title: chunk.web.title || 'View Source', domain, url: cleanUrl };
          });
        
        const allSources = await Promise.all(sourcePromises);
        
        // Deduplicate by domain, filter out failed unwraps
        const seenDomains = new Set<string>();
        sourcesData = allSources
          .filter(source => {
            if (source.domain.includes('google.com') || source.domain.includes('vertexaisearch')) return false;
            if (seenDomains.has(source.domain)) return false;
            seenDomains.add(source.domain);
            return true;
          })
          .slice(0, 8);
        
        console.log('[smart-assistant] Deduplicated sources:', sourcesData.map(s => s.domain));
      }
    }

    // Post-process response: Clean formatting issues (CRITICAL - prevents tool leak to UI)
    function cleanResponseFormatting(text: string): string {
      let cleaned = text;
      
      // ===== TOOL USAGE NARRATION REMOVAL (CRITICAL - catches "I'll use the `tool_name` tool") =====
      
      // Remove any sentence mentioning tool usage with backticked names
      // Matches: "I'll use the `search_products_online` tool...", "I will use the `google_search` tool..."
      cleaned = cleaned.replace(/^.*\b(use|using|run|running|call|calling)\b.*`[a-z0-9_]+`.*\btool\b.*$/gim, '');
      
      // Remove standalone backticked tool identifiers in tool-context sentences
      cleaned = cleaned.replace(/.*`(search_|get_|find_|save_|web_|google_)[a-z0-9_]+`.*$/gim, '');
      
      // ===== TOOL CALL LEAKAGE REMOVAL =====
      
      // Remove "Tool Call:" / "Calling Tool:" lines (case-insensitive, all variants)
      cleaned = cleaned.replace(/^Tool Call:.*$/gim, '');
      cleaned = cleaned.replace(/^Calling Tools?:.*$/gim, '');
      cleaned = cleaned.replace(/Tool Calls?:.*$/gim, '');
      cleaned = cleaned.replace(/\*\*Calling Tool\*\*:.*$/gm, '');
      
      // Remove backticked function calls (e.g., `search_reviews_semantic(...)`)
      cleaned = cleaned.replace(/`[a-z_]+\([^`]*\)`/gi, '');
      
      // Remove RAW function calls even without backticks
      cleaned = cleaned.replace(/[a-z_]+_semantic\s*\([^)]*\)/gi, '');
      cleaned = cleaned.replace(/get_user[a-z_]*\s*\([^)]*\)/gi, '');
      cleaned = cleaned.replace(/search_[a-z_]+\s*\([^)]*\)/gi, '');
      cleaned = cleaned.replace(/find_[a-z_]+\s*\([^)]*\)/gi, '');
      cleaned = cleaned.replace(/save_[a-z_]+\s*\([^)]*\)/gi, '');
      
      // Remove any line containing function names with tool identifiers
      cleaned = cleaned.replace(/.*(_semantic|get_user|save_insight|find_similar|get_product|web_search|search_user).*\(.*\).*/gi, '');
      
      // Remove backticked tool names with parameters
      cleaned = cleaned.replace(/`[a-z_]+`\s*with parameters.*$/gim, '');
      
      // ===== FENCED CODE BLOCK REMOVAL (for tool_code JSON) =====
      
      cleaned = cleaned.replace(/```[\s\S]*?"tool_code"[\s\S]*?```/gi, '');
      cleaned = cleaned.replace(/```[\s\S]*?_semantic[\s\S]*?```/gi, '');
      cleaned = cleaned.replace(/```[\s\S]*?search_reviews[\s\S]*?```/gi, '');
      cleaned = cleaned.replace(/\{[^{}]*"tool_code"[^{}]*\}/gi, '');
      
      // ===== PRE-TOOL NARRATION REMOVAL =====
      
      // Remove "please wait" / "moment to search" patterns
      cleaned = cleaned.replace(/^Please give me a moment.*$/gim, '');
      cleaned = cleaned.replace(/^Please wait.*$/gim, '');
      cleaned = cleaned.replace(/^One moment.*$/gim, '');
      cleaned = cleaned.replace(/^Searching now.*$/gim, '');
      cleaned = cleaned.replace(/^Just a moment.*$/gim, '');
      cleaned = cleaned.replace(/^Give me a (moment|second).*$/gim, '');
      cleaned = cleaned.replace(/^Hold on.*$/gim, '');
      cleaned = cleaned.replace(/^I('m| am) searching.*$/gim, '');
      
      // Existing patterns
      cleaned = cleaned.replace(/^Let me (search|look|check|find|see|use)\b.*$/gim, '');
      cleaned = cleaned.replace(/^I('ll| will) (search|look|check|find|see|use)\b.*$/gim, '');
      cleaned = cleaned.replace(/Let me see what.*users are saying.*/gi, '');
      
      // ===== SMALL TALK REMOVAL =====
      cleaned = cleaned.replace(/^(That's a great question[!,]?\s*|Great question[!,]?\s*)/i, '');
      
      // ===== CLEANUP =====
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
      
      return cleaned.trim();
    }

    // Apply formatting cleanup
    let finalAssistantMessage = cleanResponseFormatting(finalMessage);

    // Post-processing: Bad pattern fix + decision anchor check (Part 2.4)
    const badPatterns = [
      /^I didn't find specific/i,
      /^I couldn't find/i,
      /^I wasn't able to find/i,
      /^You can find a variety of/i,
      /^I can definitely help you/i,
      /^Sure! I can help/i,
      /^Absolutely!/i,
      /^Great question/i,
    ];

    let needsPrefix = false;
    for (const pattern of badPatterns) {
      if (pattern.test(finalAssistantMessage.trim())) {
        needsPrefix = true;
        console.log('[smart-assistant] Bad pattern detected, prepending decision anchor');
        break;
      }
    }

    if (needsPrefix && (queryIntent === 'realtime' || queryIntent === 'product_user')) {
      // Remove the bad opening and prepend an advisor-tone anchor
      finalAssistantMessage = finalAssistantMessage.replace(/^(I didn't find specific.*?but|I can definitely help you.*?!|Sure!.*?!|Absolutely!.*?)\s*/i, '');
      finalAssistantMessage = "Here's how I'd approach this:\n\n" + finalAssistantMessage.trim();
    }

    // Decision anchor safety net - ensure product responses have a clear recommendation
    if (queryIntent === 'product_user' || queryIntent === 'realtime') {
      const hasDecisionAnchor = /I'd recommend|I recommend|best pick|go with|start with|my pick|I'd start|I'd suggest/i.test(finalAssistantMessage);
      
      if (!hasDecisionAnchor && finalAssistantMessage.length > 100) {
        // If we have cards, use a contextual hook instead of "Quick pick" (cards speak, assistant whispers)
        if (resolverOutput?.shortlist?.length > 0) {
          console.log('[smart-assistant] Cards present - using minimal contextual hook');
          // Don't prepend anything - let the card-aware compression handle it
        } else {
          console.log('[smart-assistant] No cards - using decision anchor fallback');
          finalAssistantMessage = "Here's how I'd approach this:\n\n" + finalAssistantMessage;
        }
      }
    }
    
    // CARD-AWARE RESPONSE COMPRESSION
    // When cards are present, aggressively compress narration to avoid redundancy
    if (resolverOutput?.shortlist?.length > 0) {
      console.log('[smart-assistant] Cards present - compressing narration to avoid card duplication');
      
      // Remove rating mentions (cards show these)
      finalAssistantMessage = finalAssistantMessage
        .replace(/\d+(\.\d+)?\/\d+(\.\d+)?/g, '')  // X/Y ratings
        .replace(/rated?\s*\d+(\.\d+)?/gi, '')      // "rated 4.5"
        .replace(/\(\d+\s*reviews?\)/gi, '')        // "(6 reviews)"
        .replace(/Quick pick:.*?\n\n/gi, '')        // Remove "Quick pick" if present
        .replace(/\s+/g, ' ')                        // Clean up whitespace
        .trim();
      
      // Get entity names from shortlist to filter redundant bullets
      const entityNames = resolverOutput.shortlist.map((s: any) => 
        (s.product?.name || s.entityName || '').toLowerCase()
      ).filter(Boolean);
      
      // Remove bullet lines that just name entities (cards do this)
      const lines = finalAssistantMessage.split('\n');
      const filteredLines = lines.filter((line: string) => {
        const isBullet = /^[•\-–—*]\s*/.test(line.trim());
        if (!isBullet) return true;
        
        // Remove bullets that just name an entity
        const lineLower = line.toLowerCase();
        return !entityNames.some((name: string) => lineLower.includes(name));
      });
      
      finalAssistantMessage = filteredLines.join('\n').trim();
      
      // Cap to ~3 sentences if still too long (cards should be primary)
      const sentences = finalAssistantMessage.split(/(?<=[.!?])\s+/);
      if (sentences.length > 4) {
        finalAssistantMessage = sentences.slice(0, 3).join(' ');
        if (!finalAssistantMessage.endsWith('.') && !finalAssistantMessage.endsWith('!') && !finalAssistantMessage.endsWith('?')) {
          finalAssistantMessage += '.';
        }
      }
      
      // ANTI-HEDGING: Remove defensive/hedging language that weakens card confidence
      // The cards already show rating variance - text shouldn't add disclaimers
      finalAssistantMessage = finalAssistantMessage
        .replace(/While (one|some) of the options.*?(experience|ratings?|reviews?)\.\s*/gi, '')
        .replace(/However,?\s*(some|a few|others?).*?(negative|less positive|mixed).*?\.\s*/gi, '')
        .replace(/Keep in mind that.*?\.\s*/gi, '')
        .replace(/It's worth noting that.*?\.\s*/gi, '')
        .replace(/That said,?\s*.*?\.\s*/gi, '')
        .replace(/Some users have (also )?reported.*?\.\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('[smart-assistant] Narration compressed and hedging removed for card context');
    }

    // ========== HARD ENFORCEMENT LAYER (Post-Processing Guarantees) ==========
    // This layer ensures the model CANNOT violate agent behavioral rules
    
    // BEFORE enforcement snapshot (for debugging)
    const beforeEnforcement = {
      bulletCount: (finalAssistantMessage.match(/^[•\-–—*]\s*/gm) || []).length,
      wordCount: finalAssistantMessage.split(/\s+/).length,
      hasDecisionAnchor: /i'd recommend|i recommend|best pick|go with|start with|my pick/i.test(finalAssistantMessage),
      startsWithQuickAnswer: /^quick (answer|pick)/i.test(finalAssistantMessage.trim()),
    };
    console.log('[smart-assistant] BEFORE enforcement:', beforeEnforcement);

    // PART 1: Hard Post-Trim for Content Caps
    if (queryIntent === 'product_user' || queryIntent === 'realtime') {
      // Robust bullet pattern (catches •, -, –, —, *)
      const bulletPattern = /^[•\-–—*]\s*/gm;
      const bulletCount = (finalAssistantMessage.match(bulletPattern) || []).length;
      
      if (bulletCount > 12) {
        console.log(`[smart-assistant] Content cap violation: ${bulletCount} bullets, trimming to 12`);
        
        const lines = finalAssistantMessage.split('\n');
        let bulletsSeen = 0;
        const trimmedLines: string[] = [];
        
        for (const line of lines) {
          const isBullet = /^[•\-–—*]\s*/.test(line.trim());
          if (isBullet) {
            bulletsSeen++;
            if (bulletsSeen <= 12) {
              trimmedLines.push(line);
            }
          } else {
            trimmedLines.push(line);
          }
        }
        
        finalAssistantMessage = trimmedLines.join('\n').trim();
        
        // Add CTA if we trimmed (with guard to prevent duplicates)
        if (!/want me to/i.test(finalAssistantMessage)) {
          finalAssistantMessage += '\n\nWant me to expand on any of these?';
        }
      }
      
      // Enforce max 3-4 retailers per brand section (with safety wrapper)
      try {
        const sectionTrimPattern = new RegExp(
          `((?:${SECTION_EMOJIS})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?[\\s\\S]*?)((?:^[•\\-–—*]\\s*.+\\n?){5,})`,
          'gm'
        );
        finalAssistantMessage = finalAssistantMessage.replace(
          sectionTrimPattern,
          (match, header, bullets) => {
            const bulletLines = bullets.trim().split('\n').filter((l: string) => l.trim());
            const trimmedBullets = bulletLines.slice(0, 3).join('\n');
            console.log(`[smart-assistant] Trimmed section from ${bulletLines.length} to 3 retailers`);
            return header + trimmedBullets + '\n';
          }
        );
      } catch (regexError) {
        console.error('[smart-assistant] Section trim regex failed, skipping:', regexError);
      }
    }

    // PART 2: Hedging Language Stripping
    const hedgingPatterns = [
      /based on (general|my) knowledge,?\s*/gi,
      /widely praised\s*/gi,
      /generally offer\s*/gi,
      /generally speaking,?\s*/gi,
      /it's worth noting that\s*/gi,
      /it should be noted that\s*/gi,
      /from what I (know|understand),?\s*/gi,
      /as far as I (know|can tell),?\s*/gi,
      /I believe that\s*/gi,
      /in my understanding,?\s*/gi,
    ];

    for (const pattern of hedgingPatterns) {
      finalAssistantMessage = finalAssistantMessage.replace(pattern, '');
    }

    // Clean up double spaces and orphaned punctuation
    finalAssistantMessage = finalAssistantMessage
      .replace(/\s{2,}/g, ' ')
      .replace(/^,\s*/gm, '')
      .replace(/\s+,/g, ',');

    // PART 3: Retailer-Dump Structure Prevention
    if (queryIntent === 'product_user' || queryIntent === 'realtime') {
      let sections: RegExpMatchArray | null = [];
      
      try {
        const sectionPattern = new RegExp(
          `(?:${SECTION_EMOJIS})\\s*\\*?\\*?[A-Z][a-zA-Z\\s]+\\*?\\*?`,
          'g'
        );
        sections = finalAssistantMessage.match(sectionPattern) || [];
      } catch (regexError) {
        console.error('[smart-assistant] Section pattern regex failed, skipping dump detection:', regexError);
        sections = [];
      }
      const bulletPatternForDump = /^[•\-–—*]\s*/gm;
      const totalBullets = (finalAssistantMessage.match(bulletPatternForDump) || []).length;
      
      // If we have 3+ sections each with 3+ bullets, it's a dump
      if (sections.length >= 3 && totalBullets > 9) {
        console.log(`[smart-assistant] Retailer-dump detected: ${sections.length} sections, ${totalBullets} bullets`);
        
        // GUARD: Only prepend if no existing quick answer (prevents stacking)
        const hasQuickAnswer = /quick (pick|answer)|i'd (recommend|suggest|start)|start with|here's how i'd/i.test(finalAssistantMessage);
        
        if (!hasQuickAnswer) {
          finalAssistantMessage = "Quick answer: Start with the official brand sites for best selection, or Amazon for convenience and price comparison.\n\n" + finalAssistantMessage;
        }
        
        // Add closing CTA if not present
        if (!/want me to compare|want me to narrow|want me to expand/i.test(finalAssistantMessage)) {
          finalAssistantMessage = finalAssistantMessage.trimEnd() + '\n\nWant me to compare prices or narrow down to one option?';
        }
      }
    }

    // AFTER enforcement snapshot (for debugging)
    const afterEnforcement = {
      bulletCount: (finalAssistantMessage.match(/^[•\-–—*]\s*/gm) || []).length,
      wordCount: finalAssistantMessage.split(/\s+/).length,
      hasDecisionAnchor: /i'd recommend|i recommend|best pick|go with|start with|my pick/i.test(finalAssistantMessage),
      startsWithQuickAnswer: /^quick (answer|pick)/i.test(finalAssistantMessage.trim()),
      trimmed: beforeEnforcement.bulletCount !== (finalAssistantMessage.match(/^[•\-–—*]\s*/gm) || []).length,
    };
    console.log('[smart-assistant] AFTER enforcement:', afterEnforcement);

    // ========== FINAL RESPONSE NORMALIZATION ==========
    // This ensures clean visual structure after all enforcement passes
    console.log('[smart-assistant] Running final response normalizer');

    try {
      const beforeNormalization = finalAssistantMessage;
      finalAssistantMessage = normalizeAssistantOutput(finalAssistantMessage, queryIntent);
      
      // Log if normalization made changes
      if (beforeNormalization !== finalAssistantMessage) {
        console.log('[smart-assistant] Normalization made changes:', {
          removedDashes: beforeNormalization.includes('---') && !finalAssistantMessage.includes('---'),
          lengthDiff: beforeNormalization.length - finalAssistantMessage.length,
        });
      } else {
        console.log('[smart-assistant] Normalization skipped or no changes needed');
      }
    } catch (normalizationError) {
      console.error('[smart-assistant] Normalizer failed, skipping:', normalizationError);
      // Keep the pre-normalization message - worst case is ugly UI, not broken assistant
    }
    // ========== END FINAL RESPONSE NORMALIZATION ==========

    // ========== END HARD ENFORCEMENT LAYER ==========

    // PART 4: FINAL INVARIANT - Only fire if ALL synthesis attempts failed
    // Strict empty check: only run fallback when response is truly empty or just suppressed narration
    const isEmptyOrNarration = !finalAssistantMessage || 
      finalAssistantMessage.trim().length === 0 ||
      /^(I('ll| will) (search|look|find)|please.*moment|searching|one moment|couldn't fetch)/i.test(finalAssistantMessage.trim());

    if (isEmptyOrNarration) {
      console.log('[smart-assistant] INVARIANT: Response empty or narration, checking fallback options');
      
      // Priority 1: Resolver shortlist exists - use SAME order as UI (Codex safeguard)
      if (resolverOutput?.shortlist?.length > 0) {
        console.log('[smart-assistant] INVARIANT: Synthesizing from resolver shortlist (same order as UI)');
        
        const categoryHint = resolverOutput.shortlist[0]?.product?.entity_type || 'items';
        const confidenceLabel = resolverOutput.confidenceLabel || 'limited';
        
        // Match exact confidence label shown in UI (Codex safeguard - UI/text alignment)
        const confidenceText = confidenceLabel === 'high' 
          ? '**High confidence** — Based on trusted Common Groundz reviews'
          : confidenceLabel === 'medium'
            ? '**Medium confidence** — Based on available platform data'
            : '**Limited confidence** — Based on limited platform data';
        
        // Use resolverOutput.shortlist directly - SAME array UI consumes
        const shortlistItems = resolverOutput.shortlist.slice(0, 5).map((item: any, i: number) => {
          const name = item.product?.name || item.product?.title || 'Unknown';
          const verified = item.verified ? '✓ Platform verified' : '🌐 Web';
          const reason = item.reason || '';
          return `**${i + 1}. ${name}** [${verified}]${reason ? `\n   ${reason}` : ''}`;
        }).join('\n\n');
        
        finalAssistantMessage = `${confidenceText}, here are some ${categoryHint} recommendations:\n\n${shortlistItems}\n\nWould you like more details about any of these?`;
      }
      // Priority 2: Resolver mode ran but empty shortlist - be honest (Codex safeguard)
      else if (toolMode === 'resolver' && (!resolverOutput?.shortlist || resolverOutput.shortlist.length === 0)) {
        console.log('[smart-assistant] INVARIANT: Resolver mode but empty shortlist, honest response');
        finalAssistantMessage = "I searched Common Groundz reviews but couldn't find matches for your query yet. Would you like me to share what I know from general knowledge, or try a different search?";
      }
      // Priority 3: Check if we have sources - if so, generate a minimal response from them
      else if (sourcesData.length > 0) {
        console.log('[smart-assistant] INVARIANT: Empty text but sources exist, generating minimal response');
        const topSources = sourcesData.slice(0, 5).map((s, i) => `${i + 1}. ${s.title} (${s.domain})`).join('\n');
        finalAssistantMessage = `Here are some relevant results I found:\n\n${topSources}\n\nClick on any source above for more details.`;
      } 
      // Priority 4: Generic fallback
      else {
        console.log('[smart-assistant] INVARIANT: Empty response AND no sources AND no resolver data, providing fallback');
        finalAssistantMessage = "I couldn't fetch live results right now, but I can still help! Would you like me to share what I know about this topic, or try a different search?";
      }
    } else {
      console.log('[smart-assistant] INVARIANT: Valid response exists, skipping fallback synthesis');
    }

    // PART 4: COMPLETION QUALITY INVARIANT (ChatGPT suggestion)
    // Final safety gate - catch ANY incomplete response before returning to user
    const looksComplete = 
      finalAssistantMessage.length > 120 &&
      !/\*\*\w{1,15}$|^\s*[-•]\s*\*{0,2}\w{1,15}$|\w+\.{3}$|:\s*$/i.test(finalAssistantMessage.trim()) &&
      /[.!?]$/.test(finalAssistantMessage.trim());

    if (!looksComplete && !completionRetryAttempted && finalAssistantMessage.length > 0) {
      console.log('[smart-assistant] COMPLETION INVARIANT: Response incomplete → forcing regeneration', {
        length: finalAssistantMessage.length,
        endsWithPunctuation: /[.!?]$/.test(finalAssistantMessage.trim()),
        hasIncompletePattern: /\*\*\w{1,15}$/.test(finalAssistantMessage.trim())
      });
      
      completionRetryAttempted = true;
      
      try {
        const completionResponse = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                ...geminiMessages,
                { role: 'assistant', parts: [{ text: finalAssistantMessage }] },
                { role: 'user', parts: [{ text: 'Your previous response was cut off. Please provide a complete response to my original question. End with proper punctuation.' }] }
              ],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1800 }
            }),
          },
          2, 1000
        );
        
        if (completionResponse.ok) {
          const completionData = await completionResponse.json();
          const completedText = completionData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
          const completionFinishReason = completionData.candidates?.[0]?.finishReason;
          
          if (completedText && completedText.length > 100 && completionFinishReason === 'STOP') {
            finalAssistantMessage = cleanResponseFormatting(completedText);
            console.log('[smart-assistant] Completion regeneration successful');
          }
        }
      } catch (completionError) {
        console.error('[smart-assistant] Completion regeneration failed:', completionError);
      }
    }

    // Debug: Confirm sanitizer effectiveness
    console.log('[smart-assistant] Sanitizer check:', {
      rawHasCallingTool: finalMessage.toLowerCase().includes('calling tool'),
      rawHasToolCode: finalMessage.toLowerCase().includes('tool_code'),
      rawHasSemantic: finalMessage.toLowerCase().includes('_semantic'),
      cleanedHasCallingTool: finalAssistantMessage.toLowerCase().includes('calling tool'),
      cleanedHasToolCode: finalAssistantMessage.toLowerCase().includes('tool_code'),
      cleanedHasSemantic: finalAssistantMessage.toLowerCase().includes('_semantic'),
    });

    // Post-response safety net: If non-product query got a very short/empty response,
    // retry once with NO tools to let Gemini answer from knowledge
    // BUT: Don't retry if response is a legitimate short answer (yes/no responses)
    const lowerResponse = finalAssistantMessage.toLowerCase().trim();
    if (
      queryIntent !== 'product_user' &&
      finalAssistantMessage.trim().length < 20 &&
      !lowerResponse.startsWith('yes') &&
      !lowerResponse.startsWith('no') &&
      !retryAttempted
    ) {
      console.log('[smart-assistant] Response too short and not yes/no, retrying with no tools');
      retryAttempted = true;
      
      // Retry request with no tools
      const retryRequestBody = {
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
        // No tools - force Gemini to answer from knowledge
      };
      
      const retryResponse = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(retryRequestBody),
        },
        3,
        1000
      );
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        const retryMessage = retryData.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
        if (retryMessage && retryMessage.trim().length > finalAssistantMessage.trim().length) {
          console.log('[smart-assistant] Retry produced better response');
          finalAssistantMessage = retryMessage;
        }
      }
    }

    // 10. Save assistant response to database
    const { error: assistantMsgError } = await supabaseClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        role: 'assistant',
        content: finalAssistantMessage,
        metadata: {
          tool_calls: toolCalls || [],
          tools_executed: toolCalls?.length || 0,
          model: 'gemini-2.5-flash',
          tokens_used: aiData.usageMetadata
        }
      });

    if (assistantMsgError) {
      console.error('[smart-assistant] Error saving assistant message:', assistantMsgError);
    }

    // 11. Update conversation timestamp
    await supabaseClient
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // 12. Check if memory should be updated (Phase 6.0 enhanced triggers)
    const memoryTrigger = detectMemoryUpdateTrigger(message, finalAssistantMessage);

    if (memoryTrigger.trigger) {
      console.log('[smart-assistant] Triggering background memory update:', memoryTrigger.reason);
      
      // Use EdgeRuntime.waitUntil for reliable fire-and-forget background task
      // This ensures the memory update completes even after response is sent
      EdgeRuntime.waitUntil(
        (async () => {
          // Small delay to avoid back-to-back Gemini API calls (rate limiting)
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const memoryResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-user-memory`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || ''
              },
              body: JSON.stringify({
                conversationId: conversation.id,
                trigger: memoryTrigger.reason
              })
            });
            console.log('[smart-assistant] Memory update completed:', memoryResponse.status);
          } catch (err) {
            console.error('[smart-assistant] Memory update failed:', err);
          }
        })()
      );
    }

    const responseTime = Date.now() - startTime;
    console.log('[smart-assistant] Request completed in', responseTime, 'ms');

    // Return response to frontend with detected preference for inline confirmation
    // Only include if confidence >= 0.7 (high enough for inline chips)
    const detectedPreference = memoryTrigger.trigger && 
      memoryTrigger.preferenceType && 
      memoryTrigger.extractedValue && 
      memoryTrigger.confidence && 
      memoryTrigger.confidence >= 0.7
        ? {
            type: memoryTrigger.preferenceType,
            value: memoryTrigger.extractedValue,
            scope: memoryTrigger.scope || 'general',
            confidence: memoryTrigger.confidence,
            targetType: memoryTrigger.targetType,
          }
        : null;

    if (detectedPreference) {
      console.log('[smart-assistant] Detected preference for inline confirmation:', detectedPreference);
    }

    return new Response(JSON.stringify({
      conversationId: conversation.id,
      message: finalAssistantMessage,
      toolCalls: toolCalls || [],
      detectedPreference,
      sources: sourcesData,
      // Phase 0: Include resolver data for UI transparency
      resolverState: resolverOutput?.state || null,
      confidence: resolverOutput?.confidence || null,
      confidenceLabel: resolverOutput?.confidenceLabel || null,
      sourceSummary: resolverOutput?.sourceSummary || null,
      // Phase 4: Full transparency data - shortlist and rejected
      shortlist: resolverOutput?.shortlist?.map(item => ({
        // ID-based response for frontend entity fetching
        entityId: item.entityId,
        entityName: item.product,
        entityType: item.entityType || null,
        // Scoring and trust signals
        score: item.score,
        verified: item.verified,
        reason: item.reason || null,
        sources: item.sources,
        // Rating signals for Top Pick logic (now properly merged)
        signals: item.signals ? {
          avgRating: item.signals.avgRating || 0,
          reviewCount: item.signals.reviewCount || 0,
        } : null
      })) || null,
      rejected: resolverOutput?.rejected?.map(item => ({
        product: item.product,
        reason: item.reason
      })) || null,
      metadata: {
        responseTime,
        tokensUsed: aiData.usageMetadata,
        toolMode
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[smart-assistant] Error:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'An error occurred processing your request',
      details: error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
