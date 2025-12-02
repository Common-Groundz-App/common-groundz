import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MyStuffEmptyStateProps {
  onAddClick?: () => void;
}

const MyStuffEmptyState = ({ onAddClick }: MyStuffEmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Package className="h-12 w-12 text-muted-foreground" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">Your stuff is empty</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Start building your personal inventory by adding items you own, use, or want to try.
      </p>
      
      <Button onClick={onAddClick} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Your First Item
      </Button>
    </div>
  );
};

export default MyStuffEmptyState;
