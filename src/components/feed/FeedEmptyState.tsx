
import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';

const FeedEmptyState = () => {
  const navigate = useNavigate();
  
  return (
    <Card className="border-dashed overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <CardContent className="text-center py-12 flex flex-col items-center">
        <div className="mb-4 p-5 bg-brand-orange/10 rounded-full">
          <Search size={40} className="text-brand-orange" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No recommendations yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Recommendations will appear here as people share their experiences
        </p>
        <Button 
          size="lg"
          onClick={() => navigate('/profile')}
          className="px-8 bg-brand-orange hover:bg-brand-orange/90 transition-all"
        >
          Add your first recommendation
        </Button>
      </CardContent>
    </Card>
  );
};

export default FeedEmptyState;
