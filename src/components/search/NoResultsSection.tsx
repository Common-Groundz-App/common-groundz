import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Lightbulb, TrendingUp } from 'lucide-react';

interface NoResultsSectionProps {
  query: string;
  activeTab: string;
  onCreateEntity: () => void;
}

export const NoResultsSection: React.FC<NoResultsSectionProps> = ({
  query,
  activeTab,
  onCreateEntity
}) => {
  const getCategorySuggestions = (tab: string) => {
    switch (tab) {
      case 'books':
        return ['Fiction', 'Non-fiction', 'Biography', 'Self-help', 'Mystery'];
      case 'movies':
        return ['Action', 'Comedy', 'Drama', 'Sci-fi', 'Documentary'];
      case 'places':
        return ['Restaurant', 'Cafe', 'Hotel', 'Attraction', 'Shop'];
      case 'products':
        return ['Electronics', 'Fashion', 'Home', 'Beauty', 'Health'];
      default:
        return ['Book', 'Movie', 'Place', 'Product', 'Person'];
    }
  };

  const suggestions = getCategorySuggestions(activeTab);

  return (
    <div className="py-12 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-muted">
            <Lightbulb className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            Couldn't find what you're looking for?
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            No results found for "{query}". Help us grow our community by adding it!
          </p>
        </div>

        <Button 
          onClick={onCreateEntity}
          size="lg"
          className="gap-2 bg-primary hover:bg-primary/90"
        >
          <Plus className="w-5 h-5" />
          Add "{query}" to Groundz
        </Button>
      </div>

      {/* Category suggestions */}
      <div className="border-t pt-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Popular in {activeTab === 'all' ? 'All Categories' : activeTab}
            </span>
          </div>
          
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Badge 
                key={suggestion} 
                variant="outline" 
                className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => window.location.href = `/search?q=${encodeURIComponent(suggestion)}&mode=quick`}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Your contribution helps everyone discover great things
        </p>
      </div>
    </div>
  );
};