import React from 'react';
import { Star, Info, Globe, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface EntityV3HeaderProps {
  slug?: string;
}

export const EntityV3Header = ({ slug }: EntityV3HeaderProps) => {
  // Mock data - will be replaced with real entity data later
  const mockEntity = {
    name: 'Good Ranchers',
    image_url: 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=120&h=120&fit=crop&crop=center',
    is_verified: true,
    website_url: 'https://goodranchers.com',
    rating: 4.3,
    reviewCount: 2847,
    category: 'Food & Beverage'
  };

  const mockRatingBreakdown = [
    { stars: 5, count: 1245, percentage: 44 },
    { stars: 4, count: 854, percentage: 30 },
    { stars: 3, count: 427, percentage: 15 },
    { stars: 2, count: 171, percentage: 6 },
    { stars: 1, count: 150, percentage: 5 }
  ];

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`w-5 h-5 ${
              index < fullStars
                ? 'fill-yellow-400 text-yellow-400'
                : index === fullStars && hasHalfStar
                ? 'fill-yellow-400/50 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border-b">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Section - Brand Info */}
          <div className="lg:col-span-2">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Brand Image & Info */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <img
                    src={mockEntity.image_url}
                    alt={mockEntity.name}
                    className="w-20 h-20 lg:w-24 lg:h-24 rounded-lg object-cover border"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={mockEntity.is_verified ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {mockEntity.is_verified ? "Claimed" : "Unclaimed"}
                    </Badge>
                  </div>
                  
                  <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                    {mockEntity.name}
                  </h1>
                  
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {renderStars(mockEntity.rating)}
                      <span className="font-semibold text-lg">{mockEntity.rating}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span>{mockEntity.reviewCount.toLocaleString()} reviews</span>
                      <Info className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button variant="default" className="gap-2">
                <Edit3 className="w-4 h-4" />
                Write a review
              </Button>
              
              {mockEntity.website_url && (
                <Button variant="outline" className="gap-2">
                  <Globe className="w-4 h-4" />
                  Visit website
                </Button>
              )}
            </div>
          </div>
          
          {/* Right Section - Review Summary */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-4">Review summary</h3>
                
                <div className="space-y-3">
                  {mockRatingBreakdown.map((item) => (
                    <div key={item.stars} className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-12">
                        <span className="text-sm">{item.stars}</span>
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      </div>
                      
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      
                      <span className="text-sm text-muted-foreground w-8 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Based on {mockEntity.reviewCount.toLocaleString()} reviews
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV3Header;