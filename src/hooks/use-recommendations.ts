
export { useRecommendations } from './recommendations/recommendations/use-recommendations';

// Additional types for separating entity data from recommendation/review data
export interface RecommendationEntityRelation {
  entity_id: string;
  recommendation_id: string;
  entity?: {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    venue?: string;
    api_source?: string;
    metadata?: Record<string, any>;
  };
}
