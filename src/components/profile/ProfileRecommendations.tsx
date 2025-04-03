import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Star, Award, Bookmark, Filter, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type RecommendationItem = {
  id: string;
  title: string;
  venue: string;
  rating: number;
  image: string;
  isCertified: boolean;
  category?: string;
  likes?: number;
  isLiked?: boolean;
  isSaved?: boolean;
};

const dummyRecommendations: RecommendationItem[] = [{
  id: '1',
  title: 'Truffle Fries',
  venue: 'Smoke House Deli',
  rating: 4.6,
  image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d',
  isCertified: true,
  category: 'Food',
  likes: 43,
  isLiked: false,
  isSaved: false
}, {
  id: '2',
  title: 'Margherita Pizza',
  venue: 'Pizzeria Locale',
  rating: 4.2,
  image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
  isCertified: true,
  category: 'Food',
  likes: 29,
  isLiked: true,
  isSaved: true
}, {
  id: '3',
  title: 'French Press Coffee',
  venue: 'Artisan Cafe',
  rating: 4.5,
  image: 'https://images.unsplash.com/photo-1557142046-c704a3adf364',
  isCertified: true,
  category: 'Drinks',
  likes: 37,
  isLiked: false,
  isSaved: true
}, {
  id: '4',
  title: 'Wireless Headphones',
  venue: 'Tech Emporium',
  rating: 4.3,
  image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
  isCertified: true,
  category: 'Gadgets',
  likes: 21,
  isLiked: false,
  isSaved: false
}, {
  id: '5',
  title: 'Bluetooth Speakers',
  venue: 'Sound Studio',
  rating: 4.3,
  image: 'https://images.unsplash.com/photo-1563330232-57114bb0823c',
  isCertified: true,
  category: 'Gadgets',
  likes: 18,
  isLiked: true,
  isSaved: false
}, {
  id: '6',
  title: 'Handcrafted Leather Wallet',
  venue: 'Artisan Market',
  rating: 4.7,
  image: 'https://images.unsplash.com/photo-1627123423521-013e47bffe3c',
  isCertified: true,
  category: 'Accessories',
  likes: 32,
  isLiked: false,
  isSaved: false
}];

const RatingStars = ({
  rating
}: {
  rating: number;
}) => {
  return <div className="flex items-center">
      {[1, 2, 3, 4, 5].map(star => <Star key={star} size={16} className={cn("mr-1", star <= Math.floor(rating) ? "fill-brand-orange text-brand-orange" : star === Math.ceil(rating) && star > Math.floor(rating) ? "fill-brand-orange/50 text-brand-orange/50" : "text-gray-300")} />)}
      <span className="ml-2 font-bold text-sm">{rating.toFixed(1)}</span>
    </div>;
};

const ProfileRecommendations = () => {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(dummyRecommendations);
  const [filteredRecommendations, setFilteredRecommendations] = useState<RecommendationItem[]>(dummyRecommendations);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');
  
  const categories = [...new Set(recommendations.map(item => item.category))].filter(Boolean) as string[];
  
  useEffect(() => {
    let result = [...recommendations];
    
    if (activeFilter) {
      result = result.filter(item => item.category === activeFilter);
    }
    
    if (sortBy === 'highestRated') {
      result = result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'mostLiked') {
      result = result.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    
    setFilteredRecommendations(result);
  }, [recommendations, activeFilter, sortBy]);
  
  const handleLike = (id: string) => {
    setRecommendations(prev => 
      prev.map(item => {
        if (item.id === id) {
          const isLiked = !item.isLiked;
          return {
            ...item,
            isLiked,
            likes: (item.likes || 0) + (isLiked ? 1 : -1)
          };
        }
        return item;
      })
    );
  };
  
  const handleSave = (id: string) => {
    setRecommendations(prev => 
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            isSaved: !item.isSaved
          };
        }
        return item;
      })
    );
  };
  
  const clearFilters = () => {
    setActiveFilter(null);
    setSortBy('latest');
  };

  return (
    <div className="space-y-6 mx-0 my-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">My Recommendations</h2>
        
        <div className="flex items-center gap-2">
          {activeFilter && (
            <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
              {activeFilter}
              <button 
                onClick={clearFilters}
                className="ml-1 text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Filter size={14} />
                Filter
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem 
                  className="text-sm font-medium text-gray-500 py-1.5"
                  disabled
                >
                  Categories
                </DropdownMenuItem>
                {categories.map(category => (
                  <DropdownMenuItem 
                    key={category}
                    onClick={() => setActiveFilter(category)}
                    className={cn(
                      "cursor-pointer",
                      activeFilter === category ? "bg-gray-100" : ""
                    )}
                  >
                    {category}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem 
                  className="text-sm font-medium text-gray-500 py-1.5 mt-2"
                  disabled
                >
                  Sort By
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortBy('latest')}
                  className={cn("cursor-pointer", sortBy === 'latest' ? "bg-gray-100" : "")}
                >
                  Latest
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortBy('highestRated')}
                  className={cn("cursor-pointer", sortBy === 'highestRated' ? "bg-gray-100" : "")}
                >
                  Highest Rated
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortBy('mostLiked')}
                  className={cn("cursor-pointer", sortBy === 'mostLiked' ? "bg-gray-100" : "")}
                >
                  Most Liked
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {filteredRecommendations.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
          <p className="text-lg mb-2">No recommendations found</p>
          <p className="text-sm">Try clearing your filters or add new recommendations</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map(item => (
            <Card 
              key={item.id} 
              className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200"
            >
              <div className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="secondary" className="bg-black/70 hover:bg-black/80 text-white">
                    {item.category}
                  </Badge>
                </div>
                {item.isCertified && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="secondary" className="bg-brand-orange hover:bg-brand-orange/90 text-white flex items-center gap-1">
                      <Award size={12} />
                      <span>Certified</span>
                    </Badge>
                  </div>
                )}
                <div className="h-48 relative overflow-hidden group">
                  <img 
                    src={item.image} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold line-clamp-1">{item.title}</h3>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-8 w-8 transition-colors", 
                      item.isSaved 
                        ? "text-brand-orange" 
                        : "text-gray-500 hover:text-brand-orange"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleSave(item.id);
                    }}
                  >
                    <Bookmark size={18} className={item.isSaved ? "fill-brand-orange" : ""} />
                  </Button>
                </div>
                
                <p className="text-gray-600 mb-3 text-sm">{item.venue}</p>
                
                <RatingStars rating={item.rating} />
                
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "transition-colors flex items-center gap-1 px-2",
                      item.isLiked 
                        ? "text-red-500" 
                        : "text-gray-500 hover:text-red-500"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleLike(item.id);
                    }}
                  >
                    <Heart 
                      size={16} 
                      className={item.isLiked ? "fill-red-500" : ""} 
                    />
                    <span>{item.likes}</span>
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileRecommendations;
