
export interface CircleContributor {
  userId: string;
  rating: number;
  type: 'recommendation' | 'review';
}

export interface CircleRatingData {
  circleRating: number | null;
  circleRatingCount: number;
  circleContributors: CircleContributor[];
  isLoading: boolean;
}
