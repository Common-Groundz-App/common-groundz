// Helper function to determine if a feed item is a post
export const isItemPost = (item: any): boolean => {
  return 'is_post' in item && item.is_post === true;
};
