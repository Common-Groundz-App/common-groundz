// URL patterns for auto-fill validation

export const urlPatterns: Record<string, string[]> = {
  movie: ['imdb.com', 'themoviedb.org', 'rottentomatoes.com', 'metacritic.com'],
  tvshow: ['imdb.com', 'themoviedb.org', 'tvmaze.com'],
  book: ['goodreads.com', 'amazon.com/books', 'bookshop.org', 'barnesandnoble.com'],
  place: ['google.com/maps', 'yelp.com', 'tripadvisor.com', 'foursquare.com'],
  food: ['yelp.com', 'tripadvisor.com', 'zomato.com', 'opentable.com'],
  product: ['amazon.com', 'ebay.com', 'walmart.com', 'target.com'],
  app: ['apps.apple.com', 'play.google.com', 'microsoft.com/store'],
  game: ['steam', 'playstation.com', 'xbox.com', 'nintendo.com', 'epicgames.com'],
  course: ['coursera.org', 'udemy.com', 'edx.org', 'linkedin.com/learning', 'skillshare.com'],
  experience: ['airbnb.com/experiences', 'viator.com', 'getyourguide.com', 'tripadvisor.com'],
};

export function validateUrlForType(url: string, type: string): { isValid: boolean; message?: string } {
  const patterns = urlPatterns[type];
  
  if (!patterns) {
    // No patterns defined for this type, allow any URL
    return { isValid: true };
  }
  
  const isValid = patterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
  
  if (!isValid) {
    const expectedSources = patterns.join(', ');
    return {
      isValid: false,
      message: `This URL doesn't match the expected sources for ${type}. Expected sources: ${expectedSources}`
    };
  }
  
  return { isValid: true };
}

export function getSuggestedEntityType(url: string): string | null {
  for (const [type, patterns] of Object.entries(urlPatterns)) {
    if (patterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()))) {
      return type;
    }
  }
  return null;
}
