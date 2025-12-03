import React, { useMemo } from 'react';
import { useMyStuff } from '@/hooks/use-my-stuff';
import MyStuffItemCard from './MyStuffItemCard';
import MyStuffEmptyState from './MyStuffEmptyState';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface MyStuffItemsGridProps {
  statusFilter?: string;
  sortBy?: string;
}

const MyStuffItemsGrid = ({ statusFilter = 'all', sortBy = 'recent' }: MyStuffItemsGridProps) => {
  const { items, isLoading, updateMyStuffItem, removeFromMyStuff } = useMyStuff();

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    if (!items) return [];

    let filtered = [...items];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.entity?.name || '').localeCompare(b.entity?.name || ''));
        break;
      case 'sentiment':
        filtered.sort((a, b) => (b.sentiment_score || 0) - (a.sentiment_score || 0));
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return filtered;
  }, [items, statusFilter, sortBy]);

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

  if (filteredAndSortedItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No items match the current filter</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredAndSortedItems.map((item) => (
        <MyStuffItemCard 
          key={item.id} 
          item={item}
          onUpdate={updateMyStuffItem}
          onDelete={removeFromMyStuff}
        />
      ))}
    </div>
  );
};

export default MyStuffItemsGrid;
