import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Edit2, AlertTriangle, Brain, Quote } from 'lucide-react';
import { LearnedPreference, getConfidenceLevel } from '@/types/preferences';
import { cn } from '@/lib/utils';

interface LearnedPreferencesSectionProps {
  learnedPreferences: LearnedPreference[];
  onApprove: (scope: string, key: string, value: any) => void;
  onDismiss: (scope: string, key: string) => void;
  onEdit?: (preference: LearnedPreference) => void;
  isLoading?: boolean;
}

// Group learned preferences by scope
const groupByScope = (preferences: LearnedPreference[]) => {
  return preferences.reduce((acc, pref) => {
    if (!acc[pref.scope]) acc[pref.scope] = [];
    acc[pref.scope].push(pref);
    return acc;
  }, {} as Record<string, LearnedPreference[]>);
};

const SCOPE_ICONS: Record<string, string> = {
  skincare: '🧴',
  food: '🍱',
  movies: '🎬',
  routines: '📅',
  books: '📚',
  fitness: '💪',
};

const LearnedPreferencesSection: React.FC<LearnedPreferencesSectionProps> = ({
  learnedPreferences,
  onApprove,
  onDismiss,
  onEdit,
  isLoading = false
}) => {
  // Filter out dismissed AND approved preferences - only show pending items
  const pendingPreferences = learnedPreferences.filter(p => !p.dismissed && !p.approvedAt);
  const groupedPreferences = groupByScope(pendingPreferences);
  const pendingCount = pendingPreferences.length;

  if (isLoading) {
    return (
      <div className="p-4 bg-accent/30 rounded-md">
        <p className="text-sm text-muted-foreground animate-pulse">Loading learned preferences...</p>
      </div>
    );
  }

  // Empty state - all caught up!
  if (pendingPreferences.length === 0) {
    return (
      <div className="text-center py-8 bg-accent/20 rounded-lg">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Check className="h-6 w-6 text-green-500" />
          <Brain className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-1">You're all caught up!</p>
        <p className="text-xs text-muted-foreground">
          Approved preferences are now active in "Your Preferences" and "Things to Avoid" sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with pending count */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="text-sm text-yellow-700 dark:text-yellow-400">
            {pendingCount} preference{pendingCount > 1 ? 's' : ''} detected from conversations - review below
          </span>
        </div>
      )}

      {/* Grouped by scope */}
      {Object.entries(groupedPreferences).map(([scope, preferences]) => (
        <div key={scope} className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <span>{SCOPE_ICONS[scope] || '📌'}</span>
            {scope.charAt(0).toUpperCase() + scope.slice(1)}
          </h4>
          
          <div className="space-y-2">
            {preferences.map((pref, index) => {
              const confidence = getConfidenceLevel(pref.confidence);
              
              return (
                <div 
                  key={`${pref.scope}-${pref.key}-${index}`}
                  className="p-3 rounded-lg border transition-all bg-yellow-500/5 border-yellow-500/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{pref.key}:</span>
                        <span className="text-sm text-muted-foreground">
                          {typeof pref.value === 'object' 
                            ? JSON.stringify(pref.value) 
                            : String(pref.value)}
                        </span>
                      </div>
                      
                      {/* Confidence badge */}
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn('text-xs', confidence.color)}>
                          {confidence.label} confidence ({Math.round(pref.confidence * 100)}%)
                        </Badge>
                      </div>
                      
                      {/* Evidence quote */}
                      {pref.evidence && (
                        <div className="flex items-start gap-1 mt-2">
                          <Quote className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground italic">
                            "{pref.evidence}"
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions - always show since we only have pending items */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onApprove(pref.scope, pref.key, pref.value)}
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDismiss(pref.scope, pref.key)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                        title="Dismiss"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(pref)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LearnedPreferencesSection;
