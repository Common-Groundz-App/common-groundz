
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import RecommendationCard from './RecommendationCard';

interface RecommendationsGridProps {
  isOwnProfile: boolean;
}

const RecommendationsGrid = ({ isOwnProfile }: RecommendationsGridProps) => {
  // Mock data - would come from API in real app
  const recommendations = [
    {
      id: '1',
      name: 'The Shawshank Redemption',
      category: 'Movies',
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=400',
      score: 4.8,
      isCircleCertified: true,
      reason: 'One of the best films ever made. The story, acting and direction are all perfect.',
    },
    {
      id: '2',
      name: 'AirPods Pro',
      category: 'Products',
      image: 'https://images.unsplash.com/photo-1588423771073-b8903fbb85b5?auto=format&fit=crop&q=80&w=400',
      score: 4.5,
      isCircleCertified: true,
      reason: 'Incredible noise cancellation and sound quality. Perfect for commuting and workouts.',
    },
    {
      id: '3',
      name: 'Nobu Restaurant',
      category: 'Food',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400',
      score: 4.2,
      isCircleCertified: false,
      reason: 'Sushi that will change your life. Expensive, but worth every penny for a special occasion.',
    },
    {
      id: '4',
      name: 'Breaking Bad',
      category: 'Shows',
      image: 'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&q=80&w=400',
      score: 4.9,
      isCircleCertified: true,
      reason: 'The character development and storytelling are unmatched. A must-watch series.',
    },
    {
      id: '5',
      name: 'Kindle Paperwhite',
      category: 'Products',
      image: 'https://images.unsplash.com/photo-1553968840-becbe6f1775d?auto=format&fit=crop&q=80&w=400',
      score: 4.4,
      isCircleCertified: false,
      reason: 'Best e-reader on the market. The backlight and battery life are excellent.',
    },
    {
      id: '6',
      name: 'Atomic Habits',
      category: 'Books',
      image: 'https://images.unsplash.com/photo-1544256718-3bcf237f3974?auto=format&fit=crop&q=80&w=400',
      score: 4.7,
      isCircleCertified: true,
      reason: 'Changed my approach to building habits. Clear, actionable advice that actually works.',
    },
  ];
  
  const hasRecommendations = recommendations.length > 0;
  
  // Empty state content
  if (!hasRecommendations) {
    return (
      <div className="text-center py-16 bg-muted/30 rounded-lg">
        <h3 className="text-xl font-medium mb-4">Looks like you haven't recommended anything yet.</h3>
        
        {isOwnProfile && (
          <Button className="bg-brand-orange hover:bg-brand-orange/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Recommendation
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Recommendations</h2>
        
        {isOwnProfile && (
          <Button className="bg-brand-orange hover:bg-brand-orange/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Recommendation
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map(recommendation => (
          <RecommendationCard key={recommendation.id} recommendation={recommendation} />
        ))}
      </div>
    </div>
  );
};

export default RecommendationsGrid;
