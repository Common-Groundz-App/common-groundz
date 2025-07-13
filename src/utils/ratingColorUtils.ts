
/**
 * Gets the sentiment color for a rating value
 * This matches the color logic used in ConnectedRingsRating component
 */
export const getSentimentColor = (rating: number): string => {
  if (rating < 2) return "#ea384c"; // Red
  if (rating < 3) return "#F97316"; // Orange  
  if (rating < 4) return "#FEC006"; // Yellow
  if (rating < 4.5) return "#84cc16"; // Light green
  return "#22c55e"; // Green
};
