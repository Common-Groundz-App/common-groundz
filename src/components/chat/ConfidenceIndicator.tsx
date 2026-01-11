import { useState } from 'react';
import { Shield, Users, FileText, Package, Globe, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface SourceSummary {
  platformReviews: number;
  similarUsers: number;
  userItems: number;
  webSearchUsed: boolean;
  webSearchAttempted?: boolean;
}

interface ConfidenceIndicatorProps {
  confidenceLabel: 'high' | 'medium' | 'limited';
  resolverState?: 'success' | 'insufficient_data' | 'web_fallback' | null;
  sourceSummary?: SourceSummary | null;
}

// ChatGPT Addition #1: Human-readable confidence explanations
const CONFIDENCE_EXPLANATIONS = {
  high: "Based on strong signals from people like you and trusted reviews.",
  medium: "Based on some relevant signals, but not enough for full confidence.",
  limited: "Based on limited data. Some results may come from broader research."
};

// ChatGPT Addition #2: Primary source determination
function getPrimarySource(sourceSummary?: SourceSummary | null): string {
  if (!sourceSummary) return "Limited data";
  if (sourceSummary.similarUsers > 0) return "People like you";
  if (sourceSummary.platformReviews > 0) return "Common Groundz reviews";
  if (sourceSummary.webSearchUsed) return "Broader web research";
  return "Limited data";
}

// Confidence styling based on level
function getConfidenceStyles(label: 'high' | 'medium' | 'limited') {
  switch (label) {
    case 'high':
      return {
        badge: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
        icon: '🏠',
        label: 'High Confidence'
      };
    case 'medium':
      return {
        badge: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        icon: '📊',
        label: 'Medium Confidence'
      };
    case 'limited':
      return {
        badge: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
        icon: '🌐',
        label: 'Limited Data'
      };
  }
}

export function ConfidenceIndicator({ 
  confidenceLabel, 
  resolverState, 
  sourceSummary 
}: ConfidenceIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const styles = getConfidenceStyles(confidenceLabel);
  const primarySource = getPrimarySource(sourceSummary);
  const explanation = CONFIDENCE_EXPLANATIONS[confidenceLabel];
  
  // Check if we have any source data to show
  const hasSourceData = sourceSummary && (
    sourceSummary.platformReviews > 0 ||
    sourceSummary.similarUsers > 0 ||
    sourceSummary.userItems > 0 ||
    sourceSummary.webSearchUsed
  );

  return (
    <div className="mt-2 pt-1.5 border-t border-border/30">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between gap-2">
          {/* Main confidence badge with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium cursor-help",
                  styles.badge
                )}>
                  <span>{styles.icon}</span>
                  <span>{styles.label}</span>
                  <Info className="h-2.5 w-2.5 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[250px] text-xs">
                <p>{explanation}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Primary source indicator (ChatGPT #2) */}
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <span>Main signal:</span>
            <span className="font-medium">{primarySource}</span>
          </div>

          {/* Expand/collapse trigger */}
          {hasSourceData && (
            <CollapsibleTrigger asChild>
              <button className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors">
                {isExpanded ? (
                  <>
                    <span>Less</span>
                    <ChevronUp className="h-3 w-3" />
                  </>
                ) : (
                  <>
                    <span>Details</span>
                    <ChevronDown className="h-3 w-3" />
                  </>
                )}
              </button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded source breakdown (My Addition #3: Visual hierarchy) */}
        <CollapsibleContent>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {/* Platform reviews - solid styling */}
            {sourceSummary && sourceSummary.platformReviews > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px]">
                <FileText className="h-2.5 w-2.5 text-primary" />
                <span>{sourceSummary.platformReviews} reviews</span>
              </div>
            )}

            {/* Similar users - solid styling */}
            {sourceSummary && sourceSummary.similarUsers > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px]">
                <Users className="h-2.5 w-2.5 text-primary" />
                <span>{sourceSummary.similarUsers} similar users</span>
              </div>
            )}

            {/* User items - solid styling */}
            {sourceSummary && sourceSummary.userItems > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px]">
                <Package className="h-2.5 w-2.5 text-primary" />
                <span>{sourceSummary.userItems} your items</span>
              </div>
            )}

            {/* Web search - dashed/amber styling (My #3: Visual hierarchy) */}
            {sourceSummary && sourceSummary.webSearchUsed && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-[10px] text-amber-700 dark:text-amber-400">
                <Globe className="h-2.5 w-2.5" />
                <span>Web research</span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
