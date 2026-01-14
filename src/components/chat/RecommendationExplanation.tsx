import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Globe, AlertCircle } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface ShortlistItem {
  entityId?: string;
  entityName?: string;
  product?: string; // Legacy field name
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

interface RecommendationExplanationProps {
  shortlist?: ShortlistItem[] | null;
  rejected?: RejectedItem[] | null;
}

// ChatGPT Addition #4: Convert numeric score to qualitative label (NO numeric scores in UI)
function getMatchQuality(score: number): string {
  if (score >= 0.70) return "Strong match";
  if (score >= 0.50) return "Good match";
  if (score >= 0.30) return "Worth considering";
  return "Exploratory";
}

// My Addition #4: Source-based description
function getSourceDescription(sources: Array<{ type: string; count: number }>): string {
  const primarySource = sources[0];
  if (!primarySource) return "";
  
  switch (primarySource.type) {
    case 'similar_user':
      return "from people like you";
    case 'platform_review':
    case 'platform':
      return "based on reviews";
    case 'user_history':
    case 'user_collection':
      return "matches your collection";
    case 'web':
      return "from web research";
    default:
      return "";
  }
}

// Combined display: "Strong match from people like you"
function getMatchDisplay(score: number, sources: Array<{ type: string; count: number }>): string {
  const quality = getMatchQuality(score);
  const sourceDesc = getSourceDescription(sources);
  return sourceDesc ? `${quality} ${sourceDesc}` : quality;
}

// Get match quality styling
function getMatchQualityStyle(score: number): string {
  if (score >= 0.70) return "text-green-600 dark:text-green-400";
  if (score >= 0.50) return "text-blue-600 dark:text-blue-400";
  if (score >= 0.30) return "text-muted-foreground";
  return "text-muted-foreground/70";
}

export function RecommendationExplanation({ 
  shortlist, 
  rejected 
}: RecommendationExplanationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Don't render if no data
  if ((!shortlist || shortlist.length === 0) && (!rejected || rejected.length === 0)) {
    return null;
  }

  return (
    <div className="mt-2">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            {isExpanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            <span>Why these recommendations?</span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 space-y-3 text-[11px] bg-muted/30 rounded-md p-2.5 border border-border/40">
            {/* Matched products section */}
            {shortlist && shortlist.length > 0 && (
              <div>
                <div className="font-medium text-foreground mb-1.5 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary" />
                  Matched for you:
                </div>
                <ul className="space-y-1.5">
                  {shortlist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      {/* Verified indicator (My #3: Platform = solid, Web = outline) */}
                      {item.verified ? (
                        <Shield className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Globe className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{item.entityName || item.product}</span>
                        <span className={cn("ml-1.5", getMatchQualityStyle(item.score))}>
                          — {getMatchDisplay(item.score, item.sources)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rejected products section */}
            {rejected && rejected.length > 0 && (
              <div>
                <div className="font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Excluded:
                </div>
                <ul className="space-y-1">
                  {rejected.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground/80">
                      <span className="font-medium">{item.product}</span>
                      <span className="ml-1.5">— {item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
