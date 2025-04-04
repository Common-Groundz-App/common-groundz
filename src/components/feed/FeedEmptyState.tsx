
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const FeedEmptyState = () => {
  const navigate = useNavigate();
  
  return (
    <div className="text-center py-12 px-4">
      <div className="mb-4 flex justify-center">
        <Search size={48} className="text-gray-400" />
      </div>
      <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
      <p className="text-muted-foreground mb-6">
        Recommendations will appear here as people share their experiences
      </p>
      <Button 
        onClick={() => {
          // Open recommendation form
          const event = new CustomEvent('open-recommendation-form');
          window.dispatchEvent(event);
        }}
      >
        Add your first recommendation
      </Button>
    </div>
  );
};

export default FeedEmptyState;
