
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

/**
 * Gets the sentiment label for a rating value
 */
export const getSentimentLabel = (rating: number): string => {
  if (rating >= 4.5) return "Excellent";
  if (rating >= 4.0) return "Very Good";
  if (rating >= 3.5) return "Good";
  if (rating >= 3.0) return "Average";
  if (rating >= 2.0) return "Below Average";
  return "Poor";
};
