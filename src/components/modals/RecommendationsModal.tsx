import React, { useState, useMemo } from 'react';
import { X, Search, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RecommendationEntityCard } from '@/components/entity/RecommendationEntityCard';
import { ProcessedNetworkRecommendation } from '@/services/networkRecommendationService';
import { ProcessedFallbackRecommendation } from '@/services/fallbackRecommendationService';
import { analytics } from '@/services/analytics';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  networkRecommendations: ProcessedNetworkRecommendation[];
  fallbackRecommendations: ProcessedFallbackRecommendation[];
  hasNetworkData: boolean;
  isLoading: boolean;
}

export const RecommendationsModal: React.FC<RecommendationsModalProps> = ({
  isOpen,
  onClose,
  entityName,
  networkRecommendations,
  fallbackRecommendations,
  hasNetworkData,
  isLoading
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'recent' | 'popularity'>('relevance');

  const title = hasNetworkData 
    ? `Recommended by Your Network`
    : `Similar to ${entityName}`;

  // Combine and normalize all recommendations
  const allRecommendations = useMemo(() => {
    const network = networkRecommendations.map(rec => ({
      id: rec.entity_id,
      name: rec.entity_name,
      type: rec.entity_type,
      image_url: rec.entity_image_url,
      averageRating: rec.circle_rating || rec.average_rating,
      recommendedBy: rec.displayUsernames,
      recommendedByUserId: rec.recommendedByUserId,
      recommendedByAvatars: rec.displayAvatars,
      recommendationCount: rec.recommendation_count,
      latestRecommendationDate: rec.latest_recommendation_date,
      hasTimelineUpdates: rec.has_timeline_updates,
      slug: rec.entity_slug,
      isNetwork: true,
      reason: undefined
    }));

    const fallback = fallbackRecommendations.map(rec => ({
      id: rec.entity_id,
      name: rec.entity_name,
      type: rec.entity_type,
      image_url: rec.entity_image_url,
      averageRating: rec.average_rating,
      recommendedBy: [],
      slug: rec.entity_slug,
      isNetwork: false,
      reason: rec.displayReason
    }));

    return [...network, ...fallback];
  }, [networkRecommendations, fallbackRecommendations]);

  // Get unique categories
  const categories = useMemo(() => {
    const categorySet = new Set(allRecommendations.map(rec => rec.type));
    return Array.from(categorySet).sort();
  }, [allRecommendations]);

  // Filter and sort recommendations
  const filteredRecommendations = useMemo(() => {
    let filtered = allRecommendations.filter(rec => {
      const matchesSearch = searchQuery === '' || 
        rec.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || rec.type === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort recommendations
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          // Network recommendations first, then by rating
          if (a.isNetwork !== b.isNetwork) {
            return a.isNetwork ? -1 : 1;
          }
          return b.averageRating - a.averageRating;
        case 'rating':
          return b.averageRating - a.averageRating;
        case 'recent':
          // For now, maintain current order as we don't have timestamps
          return 0;
        case 'popularity':
          return b.recommendedBy.length - a.recommendedBy.length;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allRecommendations, searchQuery, selectedCategory, sortBy]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-xl font-semibold">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Sort Options */}
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="popularity">Popularity</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Results */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    analytics.trackRecommendationClick(
                      rec.id,
                      rec.name,
                      rec.isNetwork,
                      'modal'
                    );
                  }}
                >
                  <RecommendationEntityCard
                    recommendation={rec}
                    isNetworkRecommendation={rec.isNetwork}
                  />
                </div>
              ))}
            </div>
          ) : allRecommendations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No recommendations found at the moment. Try following more users or check back later.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No recommendations match your current filters.
              </p>
            </div>
          )}
        </div>
        
        {/* Results Count */}
        {allRecommendations.length > 0 && (
          <div className="px-4 py-2 border-t border-border text-sm text-muted-foreground">
            Showing {filteredRecommendations.length} of {allRecommendations.length} recommendations
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};