
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const FeedEmptyState = () => {
  const navigate = useNavigate();
  
  return (
    <div className="text-center py-16 px-4 bg-muted/30 rounded-lg">
      <div className="mb-6 flex justify-center">
        <div className="p-6 rounded-full bg-muted flex items-center justify-center">
          <Search size={48} className="text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-xl font-medium mb-3">No recommendations yet</h3>
      <p className="text-muted-foreground mb-8 max-w-md mx-auto">
        Recommendations will appear here as people share their experiences
      </p>
      <Button 
        size="lg"
        className="bg-brand-orange hover:bg-brand-orange/90"
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
