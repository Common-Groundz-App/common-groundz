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
