
// Define valid database post types
export type DatabasePostType = 'story' | 'routine' | 'project' | 'note' | 'comparison' | 'question' | 'tip' | 'update';
// Define all UI post types
export type UIPostType = DatabasePostType | 'journal' | 'watching';

// Map UI post types to database post types
export const mapPostTypeToDatabase = (uiType: UIPostType): DatabasePostType => {
  switch (uiType) {
    case 'journal': return 'note';  // Map journal to note
    case 'watching': return 'note'; // Map watching to note
    default: return uiType as DatabasePostType;
  }
};

// Function to get post type display name
export const getPostTypeLabel = (type: string): string => {
  switch(type) {
    case 'story': return 'Experience';
    case 'routine': return 'Routine';
    case 'project': return 'Project';
    case 'note': return 'Note';
    case 'journal': return 'Journal';
    case 'watching': return 'Currently Watching';
    case 'comparison': return 'Comparison';
    case 'question': return 'Question';
    case 'tip': return 'Tip';
    case 'update': return 'Update';
    default: return type;
  }
};

// Post type options for chip selector in create flow
export const POST_TYPE_OPTIONS: { value: DatabasePostType; label: string; placeholder: string }[] = [
  { value: 'comparison', label: 'Comparison', placeholder: 'Compare two or more options...' },
  { value: 'question', label: 'Question', placeholder: 'What would you like to know?' },
  { value: 'tip', label: 'Tip', placeholder: 'Share a helpful tip...' },
  { value: 'update', label: 'Update', placeholder: 'Share an update on your experience...' },
];

// Whitelist check — only show badge for known non-default types
const BADGE_TYPES = ['comparison', 'question', 'tip', 'update'];
export const shouldShowTypeBadge = (type: string | null | undefined): boolean => {
  if (!type) return false;
  return BADGE_TYPES.includes(type);
};

// Get placeholder text for a post type
export const getPlaceholderForType = (type: string): string => {
  const option = POST_TYPE_OPTIONS.find(o => o.value === type);
  return option?.placeholder || 'Share your experience...';
};
