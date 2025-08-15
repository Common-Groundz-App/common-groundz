/**
 * Utility function to check if a pathname is related to exploration
 * This includes the main explore page, search pages, and hashtag pages
 */
export function isExploreRelatedRoute(pathname: string): boolean {
  return pathname === '/explore' || 
         pathname.startsWith('/search') || 
         pathname.startsWith('/t/');
}