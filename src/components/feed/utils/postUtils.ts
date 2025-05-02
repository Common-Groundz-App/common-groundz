
// Define valid database post types
export type DatabasePostType = 'story' | 'routine' | 'project' | 'note';
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
    case 'story': return 'Story';
    case 'routine': return 'Routine';
    case 'project': return 'Project';
    case 'note': return 'Note';
    case 'journal': return 'Journal';
    case 'watching': return 'Currently Watching';
    default: return type;
  }
};
