
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Star, Award, Bookmark, Filter, ChevronDown, Plus, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRecommendations } from '@/hooks/use-recommendations';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import { Recommendation } from '@/services/recommendationService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    food: 'Food',
    movie: 'Movie',
    product: 'Product',
    book: 'Book',
    place: 'Place'
  };
  return labels[category] || category;
};

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

type ProfileRecommendationsProps = {
  profileUserId?: string;
};

const ProfileRecommendations = ({ profileUserId }: ProfileRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const {
    recommendations,
    isLoading,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    handleLike,
    handleSave,
    handleImageUpload,
    addRecommendation,
    clearFilters
  } = useRecommendations({ 
    profileUserId: profileUserId || (user?.id || '') 
  });
  
  const categories = [...new Set(recommendations.map(item => item.category))];
  const isOwnProfile = user?.id === profileUserId || (!profileUserId && !!user);
  
  const handleFormSubmit = async (values: any) => {
    const result = await addRecommendation({
      title: values.title,
      venue: values.venue || null,
      description: values.description || null,
      rating: values.rating,
      image_url: values.image_url,
      category: values.category,
      visibility: values.visibility,
      is_certified: false,
      view_count: 0
    });
    
    if (result) {
      toast({
        title: "Recommendation added",
        description: "Your recommendation has been added successfully"
      });
    }
  };

  return (
    <div className="space-y-6 mx-0 my-0">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">
          {isOwnProfile ? 'My Recommendations' : 'Recommendations'}
        </h2>
        
        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Button 
              onClick={() => setIsFormOpen(true)}
              size="sm" 
              className="bg-brand-orange hover:bg-brand-orange/90 text-white"
            >
              <Plus size={16} className="mr-1" /> Add New
            </Button>
          )}
          
          {activeFilter && (
            <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
              {getCategoryLabel(activeFilter)}
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
                    {getCategoryLabel(category)}
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
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(item => (
            <Card key={item} className="overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-200"></div>
              <CardContent className="p-4">
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-100 rounded mb-3"></div>
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
          <p className="text-lg mb-2">No recommendations found</p>
          <p className="text-sm">
            {activeFilter 
              ? 'Try clearing your filters or add new recommendations'
              : isOwnProfile 
                ? 'Share your first recommendation to get started'
                : 'This user has not added any recommendations yet'}
          </p>
          {activeFilter && (
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          )}
          {isOwnProfile && !activeFilter && (
            <Button 
              variant="outline" 
              className="mt-4 bg-brand-orange text-white hover:bg-brand-orange/90"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus size={16} className="mr-1" /> Add Recommendation
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map(item => (
            <Card 
              key={item.id} 
              className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-200"
            >
              <div className="relative">
                <div className="absolute top-3 left-3 z-10">
                  <Badge variant="secondary" className="bg-black/70 hover:bg-black/80 text-white">
                    {getCategoryLabel(item.category)}
                  </Badge>
                </div>
                {item.is_certified && (
                  <div className="absolute top-3 right-3 z-10">
                    <Badge variant="secondary" className="bg-brand-orange hover:bg-brand-orange/90 text-white flex items-center gap-1">
                      <Award size={12} />
                      <span>Certified</span>
                    </Badge>
                  </div>
                )}
                <div className="h-48 relative overflow-hidden group">
                  <img 
                    src={item.image_url || 'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07'} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-3 w-full flex justify-between items-center">
                      <div className="flex items-center gap-1 text-white">
                        <Eye size={14} />
                        <span className="text-xs">{item.view_count}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs border-0 text-white",
                          item.visibility === 'private' ? "bg-red-500/70" : 
                          item.visibility === 'circle_only' ? "bg-blue-500/70" : "bg-green-500/70"
                        )}
                      >
                        {item.visibility === 'public' ? 'Public' : 
                         item.visibility === 'private' ? 'Private' : 'Circle Only'}
                      </Badge>
                    </div>
                  </div>
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
                
                <p className="text-gray-600 mb-3 text-sm">{item.venue || 'Unknown venue'}</p>
                
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
      
      {user && (
        <RecommendationForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          onImageUpload={handleImageUpload}
        />
      )}
    </div>
  );
};

export default ProfileRecommendations;
