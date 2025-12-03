import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, SlidersHorizontal } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AddToMyStuffModal from './AddToMyStuffModal';

interface MyStuffFiltersProps {
  statusFilter: string;
  sortBy: string;
  onStatusFilterChange: (value: string) => void;
  onSortByChange: (value: string) => void;
}

const MyStuffFilters = ({ 
  statusFilter, 
  sortBy, 
  onStatusFilterChange, 
  onSortByChange 
}: MyStuffFiltersProps) => {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Item
        </Button>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="currently_using">Currently Using</SelectItem>
            <SelectItem value="used_before">Used Before</SelectItem>
            <SelectItem value="want_to_try">Want to Try</SelectItem>
            <SelectItem value="wishlist">Wishlist</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Added</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="sentiment">Sentiment Score</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" className="ml-auto hidden sm:flex">
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <AddToMyStuffModal open={showAddModal} onOpenChange={setShowAddModal} />
    </>
  );
};

export default MyStuffFilters;
