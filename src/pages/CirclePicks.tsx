
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TubelightTabs, TabsContent } from '@/components/ui/tubelight-tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { CirclePickCard } from '@/components/circle-picks/CirclePickCard';
import { CirclePicksHeader } from '@/components/circle-picks/CirclePicksHeader';
import { CirclePicksGrid } from '@/components/circle-picks/CirclePicksGrid';
import { MyContentSection } from '@/components/circle-picks/MyContentSection';
import { useCirclePicksFetch } from '@/hooks/circle-picks/use-circle-picks-fetch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const CirclePicks = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'most_liked' | 'highest_rated'>('recent');
  const [showMyContent, setShowMyContent] = useState(false);

  const { 
    recommendations, 
    reviews, 
    myRecommendations,
    myReviews,
    isLoading, 
    error 
  } = useCirclePicksFetch({
    userId: user?.id,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    sortBy
  });

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'Food', label: 'Food' },
    { value: 'Drink', label: 'Drink' },
    { value: 'Movie', label: 'Movie' },
    { value: 'Book', label: 'Book' },
    { value: 'Product', label: 'Product' },
    { value: 'Place', label: 'Place' },
    { value: 'Activity', label: 'Activity' },
    { value: 'Music', label: 'Music' },
    { value: 'Art', label: 'Art' },
    { value: 'TV', label: 'TV' },
    { value: 'Travel', label: 'Travel' }
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <VerticalTubelightNavbar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Please sign in to see your circle's picks</p>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <VerticalTubelightNavbar />
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-8">
          <CirclePicksHeader 
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load circle picks. Please try again.</p>
            </div>
          ) : (
            <>
              <CirclePicksGrid 
                recommendations={recommendations}
                reviews={reviews}
              />

              <MyContentSection
                recommendations={myRecommendations}
                reviews={myReviews}
                isExpanded={showMyContent}
                onToggle={() => setShowMyContent(!showMyContent)}
              />
            </>
          )}
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
};

export default CirclePicks;
