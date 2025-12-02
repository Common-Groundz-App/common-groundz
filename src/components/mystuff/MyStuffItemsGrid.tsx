import React from 'react';
import { useMyStuff } from '@/hooks/use-my-stuff';
import MyStuffItemCard from './MyStuffItemCard';
import MyStuffEmptyState from './MyStuffEmptyState';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const MyStuffItemsGrid = () => {
  const { items, isLoading } = useMyStuff();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <MyStuffEmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
        <MyStuffItemCard key={item.id} item={item} />
      ))}
    </div>
  );
};

export default MyStuffItemsGrid;
