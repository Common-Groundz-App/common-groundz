import React from 'react';
import { useParams } from 'react-router-dom';
import { ChevronRight, Star, Share, Edit3, Heart, Camera, MapPin, Globe } from 'lucide-react';
import NavBarComponent from '@/components/NavBarComponent';
import { EntityPreviewToggle } from '@/components/entity/EntityPreviewToggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const EntityV3 = () => {
  const { slug } = useParams<{ slug: string }>();

  // Mock data
  const mockEntity = {
    name: 'Taj Palace Restaurant',
    category: 'Indian Restaurant',
    rating: 4.5,
    reviewCount: 1247,
    ranking: '#1 of 200 Restaurants in Bangalore',
    tags: ['Indian', 'Asian', '₹₹₹₹'],
    claimed: true,
    location: 'Brigade Road, Bangalore'
  };

  const breadcrumbs = [
    { label: 'Asia', href: '#' },
    { label: 'India', href: '#' },
    { label: 'Karnataka', href: '#' },
    { label: 'Bangalore', href: '#' },
    { label: 'Restaurants', href: '#' }
  ];

  const heroImages = [
    {
      url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
      category: 'Interior',
      count: 127
    },
    {
      url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
      category: 'Food',
      count: 89
    },
    {
      url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
      category: 'Exterior',
      count: 45
    }
  ];

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`${sizeClass} ${
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
    <div className="min-h-screen bg-white">
      {/* Top Navigation */}
      <NavBarComponent />
      
      {/* Version Toggle */}
      <EntityPreviewToggle />
      
      {/* Main Content */}
      <div className="pt-16">
        {/* Breadcrumbs */}
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center text-sm text-muted-foreground">
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={index}>
                  <a href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </a>
                  {index < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-2" />
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>

        {/* Entity Title Section */}
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                    {mockEntity.name}
                  </h1>
                  {mockEntity.claimed && (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                      ✓ Claimed
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    {renderStars(mockEntity.rating)}
                    <span className="font-semibold text-lg">{mockEntity.rating}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {mockEntity.reviewCount.toLocaleString()} reviews
                  </span>
                </div>

                <p className="text-muted-foreground mb-2">{mockEntity.ranking}</p>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {mockEntity.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Share className="w-4 h-4" />
                  Share
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Edit3 className="w-4 h-4" />
                  Review
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Heart className="w-4 h-4" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Image Section */}
        <div className="bg-white">
          <div className="container mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-96">
              {/* Main Image */}
              <div className="lg:col-span-3 relative group cursor-pointer overflow-hidden rounded-lg">
                <img
                  src={heroImages[0].url}
                  alt="Restaurant interior"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <span className="text-sm font-medium flex items-center gap-1">
                    <Camera className="w-4 h-4" />
                    {heroImages[0].category} ({heroImages[0].count})
                  </span>
                </div>
              </div>

              {/* Side Images */}
              <div className="space-y-4">
                {heroImages.slice(1).map((image, index) => (
                  <div key={index} className="relative group cursor-pointer overflow-hidden rounded-lg h-44">
                    <img
                      src={image.url}
                      alt={`${image.category} view`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                    <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                      {image.category} ({image.count})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b sticky top-16 z-40">
          <div className="container mx-auto px-4">
            <nav className="flex space-x-8">
              {['Overview', 'Hours', 'Location', 'Reviews'].map((tab) => (
                <button
                  key={tab}
                  className="py-4 px-1 border-b-2 border-transparent hover:border-primary/50 focus:border-primary text-muted-foreground hover:text-foreground focus:text-foreground transition-colors font-medium"
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content placeholder */}
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>Tab content will be added here...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityV3;