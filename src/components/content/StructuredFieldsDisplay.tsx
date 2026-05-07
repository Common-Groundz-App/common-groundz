import * as React from 'react';
import { ThumbsUp, ThumbsDown, Clock, Users, RefreshCw, Trophy, HelpCircle, Lightbulb, AlertTriangle, DollarSign, Heart, CheckCircle, XCircle } from 'lucide-react';
import { hasStructuredContent, ALLOWED_STRUCTURED_KEYS, DURATION_OPTIONS, STRUCTURED_FIELDS_BY_TYPE } from '@/types/structuredFields';
import type { DatabasePostType } from '@/components/feed/utils/postUtils';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';

interface StructuredFieldsDisplayProps {
  data: Record<string, any>;
  postType?: string;
}

/** Map field keys to icons */
const FIELD_ICONS: Record<string, React.ReactNode> = {
  what_worked: <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />,
  what_didnt: <ThumbsDown className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />,
  why_recommend: <Heart className="h-4 w-4 text-pink-500 dark:text-pink-400 mt-0.5 flex-shrink-0" />,
  not_for: <XCircle className="h-4 w-4 text-orange-500 dark:text-orange-400 mt-0.5 flex-shrink-0" />,
  winner: <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />,
  reasoning: <CheckCircle className="h-4 w-4 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />,
  options_considered: <HelpCircle className="h-4 w-4 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />,
  what_matters: <Users className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />,
  budget: <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />,
  tip_summary: <Lightbulb className="h-4 w-4 text-yellow-500 dark:text-yellow-400 mt-0.5 flex-shrink-0" />,
  when_to_use: <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />,
  mistakes_to_avoid: <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />,
};

/** Get the display label for a field key based on post type */
function getFieldLabel(key: string, postType: DatabasePostType): string {
  const fields = STRUCTURED_FIELDS_BY_TYPE[postType] || STRUCTURED_FIELDS_BY_TYPE.experience;
  const fieldConfig = fields.find(f => f.key === key);
  if (fieldConfig) return fieldConfig.label;
  // Fallbacks
  switch (key) {
    case 'what_worked': return 'What worked';
    case 'what_didnt': return "What didn't work";
    case 'good_for': return 'Good for';
    default: return key.replace(/_/g, ' ');
  }
}

const StructuredFieldsDisplay: React.FC<StructuredFieldsDisplayProps> = ({ data, postType: postTypeProp }) => {
  if (!data || typeof data !== 'object' || !hasStructuredContent(data)) return null;

  const postType = (postTypeProp as DatabasePostType) || 'experience';

  // Only render allowed keys
  const safeData: Record<string, any> = {};
  for (const key of ALLOWED_STRUCTURED_KEYS) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      safeData[key] = data[key];
    }
  }

  // Narrative fields (textarea-type: long form text blocks)
  const narrativeKeys = ['what_worked', 'what_didnt', 'why_recommend', 'reasoning', 'options_considered', 'tip_summary', 'mistakes_to_avoid'];
  const hasNarrative = narrativeKeys.some(k => safeData[k]);

  // Metadata fields (short inline display)
  const metadataKeys = ['duration', 'good_for', 'not_for', 'winner', 'what_matters', 'budget', 'when_to_use'];
  const hasMetadata = metadataKeys.some(k => safeData[k]);

  // Yes/No fields
  const yesNoKeys = ['reuse_intent', 'worth_it', 'recommend_intent'];
  const hasYesNo = yesNoKeys.some(k => safeData[k]);

  const yesNoLabels: Record<string, { yes: string; no: string }> = {
    reuse_intent: { yes: 'Would use again', no: 'Would not use again' },
    worth_it: { yes: 'Worth it', no: 'Not worth it' },
    recommend_intent: { yes: 'Would recommend', no: 'Would not recommend' },
  };

  return (
    <div className="mt-4 space-y-3">
      {/* Rating (Review) */}
      {typeof safeData.rating === 'number' && safeData.rating >= 1 && (
        <div className="flex items-center gap-2">
          <ConnectedRingsRating
            value={safeData.rating}
            size="xs"
            isInteractive={false}
            minimal={true}
          />
        </div>
      )}

      {/* Narrative section */}
      {hasNarrative && (
        <div className="space-y-2">
          {narrativeKeys.map(key => {
            if (!safeData[key]) return null;
            return (
              <div key={key} className="flex gap-2 items-start">
                {FIELD_ICONS[key] || <ThumbsUp className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {getFieldLabel(key, postType)}
                  </p>
                  <p className="text-sm text-foreground">{safeData[key]}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Metadata row */}
      {hasMetadata && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {safeData.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {DURATION_OPTIONS[safeData.duration] || safeData.duration}
            </span>
          )}
          {metadataKeys.filter(k => k !== 'duration').map(key => {
            if (!safeData[key]) return null;
            return (
              <span key={key} className="flex items-center gap-1">
                {FIELD_ICONS[key] || <Users className="h-3.5 w-3.5" />}
                {safeData[key]}
              </span>
            );
          })}
        </div>
      )}

      {/* Yes/No pills */}
      {hasYesNo && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {yesNoKeys.map(key => {
            if (!safeData[key]) return null;
            const labels = yesNoLabels[key];
            const isYes = safeData[key] === 'yes';
            return (
              <span
                key={key}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isYes ? labels.yes : labels.no}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StructuredFieldsDisplay;
