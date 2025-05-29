
import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CirclePickCard } from './CirclePickCard';

interface MyContentSectionProps {
  recommendations: any[];
  reviews: any[];
  isExpanded: boolean;
  onToggle: () => void;
}

export const MyContentSection = ({
  recommendations,
  reviews,
  isExpanded,
  onToggle
}: MyContentSectionProps) => {
  const myItems = [
    ...recommendations.map(item => ({ ...item, type: 'recommendation' })),
    ...reviews.map(item => ({ ...item, type: 'review' }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (myItems.length === 0) {
    return null;
  }

  return (
    <div className="border-t pt-6">
      <Button
        variant="ghost"
        onClick={onToggle}
        className="flex items-center gap-2 mb-4 p-0 h-auto hover:bg-transparent"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span className="font-semibold">My Content ({myItems.length})</span>
      </Button>

      {isExpanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {myItems.map((item) => (
            <CirclePickCard
              key={`my-${item.type}-${item.id}`}
              item={item}
              type={item.type}
            />
          ))}
        </div>
      )}
    </div>
  );
};
