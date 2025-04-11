
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const FeedEmptyState = () => {
  const navigate = useNavigate();
  
  return (
    <Card className="border-dashed">
      <CardContent className="text-center py-12 flex flex-col items-center">
        <div className="mb-4 p-4 bg-muted rounded-full">
          <Search size={40} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No recommendations yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Recommendations will appear here as people share their experiences
        </p>
        <Button 
          size="lg"
          onClick={() => navigate('/profile')}
          className="px-6"
        >
          Add your first recommendation
        </Button>
      </CardContent>
    </Card>
  );
};

export default FeedEmptyState;
