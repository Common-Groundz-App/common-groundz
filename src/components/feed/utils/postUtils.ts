export type DatabasePostType = 'experience' | 'review' | 'recommendation' | 'comparison' | 'question' | 'tip';

export const getPostTypeLabel = (type: string): string => {
  switch (type) {
    case 'experience': return 'Experience';
    case 'review': return 'Review';
    case 'recommendation': return 'Recommendation';
    case 'comparison': return 'Comparison';
    case 'question': return 'Question';
    case 'tip': return 'Tip';
    default: return 'Experience';
  }
};

export const POST_TYPE_OPTIONS: { value: DatabasePostType; label: string; placeholder: string }[] = [
  { value: 'experience', label: 'Experience', placeholder: 'Share your experience...' },
  { value: 'review', label: 'Review', placeholder: 'Share your detailed review...' },
  { value: 'recommendation', label: 'Recommendation', placeholder: 'What do you recommend and why?' },
  { value: 'comparison', label: 'Comparison', placeholder: 'Compare two or more things...' },
  { value: 'question', label: 'Question', placeholder: 'What do you want to know?' },
  { value: 'tip', label: 'Tip', placeholder: 'Share a quick tip or hack...' },
];

const BADGE_TYPES = ['review', 'recommendation', 'comparison', 'question', 'tip'];

export const shouldShowTypeBadge = (type: string): boolean => BADGE_TYPES.includes(type);

export const getPlaceholderForType = (type: DatabasePostType): string => {
  const option = POST_TYPE_OPTIONS.find((o) => o.value === type);
  return option?.placeholder ?? 'Share your experience...';
};

/**
 * Color tokens per post type. Hardcoded full Tailwind class strings so
 * the JIT compiler picks them up — never use string interpolation here.
 */
export const POST_TYPE_COLORS: Record<DatabasePostType, { pill: string; dot: string }> = {
  experience: {
    pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',
    dot: 'bg-orange-500',
  },
  review: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  recommendation: {
    pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30',
    dot: 'bg-blue-500',
  },
  comparison: {
    pill: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
    dot: 'bg-purple-500',
  },
  question: {
    pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    dot: 'bg-amber-500',
  },
  tip: {
    pill: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:border-teal-500/30',
    dot: 'bg-teal-500',
  },
};

export const getPostTypeColors = (type: string) =>
  POST_TYPE_COLORS[(type as DatabasePostType)] ?? POST_TYPE_COLORS.experience;
