
import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';

interface EmptyRecommendationsProps {
  isOwnProfile: boolean;
  hasActiveFilter: boolean;
  onClearFilters: () => void;
  onAddNew: () => void;
}

const EmptyRecommendations = ({ 
  isOwnProfile, 
  hasActiveFilter, 
  onClearFilters, 
  onAddNew 
}: EmptyRecommendationsProps) => {
  return (
    <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
      <p className="text-lg mb-2">No recommendations found</p>
      <p className="text-sm">
        {hasActiveFilter 
          ? 'Try clearing your filters or add new recommendations'
          : isOwnProfile 
            ? 'Share your first recommendation to get started'
            : 'This user has not added any recommendations yet'}
      </p>
      {hasActiveFilter && (
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={onClearFilters}
        >
          Clear Filters
        </Button>
      )}
      {isOwnProfile && !hasActiveFilter && (
        <Button 
          variant="outline" 
          className="mt-4 bg-brand-orange text-white hover:bg-brand-orange/90"
          onClick={onAddNew}
        >
          <Plus size={16} className="mr-1" /> Add Recommendation
        </Button>
      )}
    </div>
  );
};

export default EmptyRecommendations;
