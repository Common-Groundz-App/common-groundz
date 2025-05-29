
import React from 'react';
import { CirclePickCard } from './CirclePickCard';

interface CirclePicksGridProps {
  recommendations: any[];
  reviews: any[];
}

export const CirclePicksGrid = ({ recommendations, reviews }: CirclePicksGridProps) => {
  // Combine and sort recommendations and reviews
  const allItems = [
    ...recommendations.map(item => ({ ...item, type: 'recommendation' })),
    ...reviews.map(item => ({ ...item, type: 'review' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allItems.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-lg font-semibold mb-2">No picks from your circle yet</h3>
        <p className="text-muted-foreground">
          Follow more people to see their recommendations and reviews here
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
      {allItems.map((item) => (
        <CirclePickCard
          key={`${item.type}-${item.id}`}
          item={item}
          type={item.type}
        />
      ))}
    </div>
  );
};
