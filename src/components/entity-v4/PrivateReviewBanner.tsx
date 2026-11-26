import React from 'react';
import { Lock, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Card-top privacy banner; mirrors the "From Your Circle" banner layout. */
export const PRIVATE_CARD_CLASSES =
  'border border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20';

export const PrivateReviewBanner: React.FC = () => (
  <div className="flex flex-wrap items-center gap-2 mb-4" data-testid="private-review-banner">
    <Badge className="bg-amber-600 text-white hover:bg-amber-600 dark:bg-amber-500 dark:text-amber-950">
      <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
      Private
    </Badge>
    <EyeOff className="w-4 h-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Only visible to you</span>
  </div>
);

export const PrivateBadge: React.FC = () => (
  <Badge className="bg-amber-600 text-white hover:bg-amber-600 dark:bg-amber-500 dark:text-amber-950 text-xs px-2 py-0" title="Only visible to you">
    <Lock className="w-3 h-3 mr-1" aria-hidden="true" />
    Private
  </Badge>
);
