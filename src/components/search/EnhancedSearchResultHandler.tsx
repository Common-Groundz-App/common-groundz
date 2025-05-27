
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { Plus, Star, MapPin, Calendar, User, Book, Film, Utensils } from 'lucide-react';
import { findOrCreateEntity } from '@/services/recommendation/entityOperations';
import type { ProductSearchResult } from '@/hooks/use-unified-search';

interface EnhancedSearchResultHandlerProps {
  result: ProductSearchResult;
  query: string;
  onClose: () => void;
}

export function EnhancedSearchResultHandler({ 
  result, 
  query, 
  onClose 
}: EnhancedSearchResultHandlerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'book': return <Book className="h-4 w-4" />;
      case 'movie': return <Film className="h-4 w-4" />;
      case 'food': return <Utensils className="h-4 w-4" />;
      case 'place': return <MapPin className="h-4 w-4" />;
      default: return <Plus className="h-4 w-4" />;
    }
  };

  const handleCreateAndNavigate = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save and view entities",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🏗️ Creating entity from search result:', result.name);
      
      // Enhanced metadata extraction based on source
      let enhancedMetadata = { ...result.metadata };
      
      // Add search context
      enhancedMetadata.searchQuery = query;
      enhancedMetadata.foundVia = 'search';
      enhancedMetadata.createdAt = new Date().toISOString();
      
      // Source-specific metadata enhancement
      if (result.api_source === 'omdb' && result.metadata) {
        enhancedMetadata = {
          ...enhancedMetadata,
          imdbID: result.metadata.imdbID,
          year: result.metadata.Year,
          genre: result.metadata.Genre,
          director: result.metadata.Director,
          actors: result.metadata.Actors,
          plot: result.metadata.Plot,
          runtime: result.metadata.Runtime,
          language: result.metadata.Language,
          country: result.metadata.Country,
          awards: result.metadata.Awards,
          imdbRating: result.metadata.imdbRating,
          rottenTomatoesRating: result.metadata.Ratings?.find((r: any) => r.Source === 'Rotten Tomatoes')?.Value
        };
      }
      
      if (result.api_source === 'google_books' && result.metadata) {
        enhancedMetadata = {
          ...enhancedMetadata,
          authors: result.metadata.authors,
          publisher: result.metadata.publisher,
          publishedDate: result.metadata.publishedDate,
          pageCount: result.metadata.pageCount,
          categories: result.metadata.categories,
          averageRating: result.metadata.averageRating,
          ratingsCount: result.metadata.ratingsCount,
          language: result.metadata.language,
          isbn: result.metadata.industryIdentifiers,
          preview: result.metadata.previewLink,
          infoLink: result.metadata.infoLink
        };
      }

      if (result.api_source === 'google_places' && result.metadata) {
        enhancedMetadata = {
          ...enhancedMetadata,
          placeId: result.api_ref,
          formatted_address: result.metadata.formatted_address,
          phone: result.metadata.formatted_phone_number,
          website: result.metadata.website,
          rating: result.metadata.rating,
          user_ratings_total: result.metadata.user_ratings_total,
          price_level: result.metadata.price_level,
          types: result.metadata.types,
          opening_hours: result.metadata.opening_hours,
          photos: result.metadata.photos,
          photo_reference: result.metadata.photos?.[0]?.photo_reference
        };
      }

      // Create the entity with enhanced metadata
      const entity = await findOrCreateEntity(
        result.name,
        result.type as any,
        result.api_source,
        result.api_ref,
        result.venue,
        result.description,
        result.image_url,
        enhancedMetadata,
        user.id
      );

      if (entity) {
        console.log('✅ Entity created/found:', entity.slug);
        
        toast({
          title: "Entity saved",
          description: `"${result.name}" has been saved to your database`,
        });
        
        onClose();
        navigate(`/entity/${entity.slug}`);
      } else {
        throw new Error('Failed to create entity');
      }
      
    } catch (error) {
      console.error('❌ Error creating entity:', error);
      toast({
        title: "Error",
        description: "Failed to save entity. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Enhanced result display with more metadata
  const renderMetadata = () => {
    const items = [];
    
    if (result.metadata) {
      // Common metadata for all types
      if (result.metadata.year || result.metadata.Year) {
        items.push(
          <div key="year" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {result.metadata.year || result.metadata.Year}
          </div>
        );
      }
      
      if (result.metadata.rating || result.metadata.averageRating || result.metadata.imdbRating) {
        const rating = result.metadata.rating || result.metadata.averageRating || result.metadata.imdbRating;
        items.push(
          <div key="rating" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating}
          </div>
        );
      }
      
      // Type-specific metadata
      if (result.api_source === 'omdb') {
        if (result.metadata.Director) {
          items.push(
            <div key="director" className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {result.metadata.Director}
            </div>
          );
        }
      }
      
      if (result.api_source === 'google_books') {
        if (result.metadata.authors?.length > 0) {
          items.push(
            <div key="authors" className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {result.metadata.authors.join(', ')}
            </div>
          );
        }
      }
      
      if (result.api_source === 'google_places') {
        if (result.metadata.formatted_address) {
          items.push(
            <div key="address" className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {result.metadata.formatted_address}
            </div>
          );
        }
      }
    }
    
    return items;
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 transition-colors"
      onClick={handleCreateAndNavigate}
    >
      <div className="relative flex-shrink-0">
        <ImageWithFallback
          src={result.image_url || ''}
          alt={result.name}
          className="w-12 h-12 object-cover rounded-md"
          entityType={result.type}
        />
        <div className="absolute -top-1 -right-1">
          <Badge variant="secondary" className="h-5 px-1 text-xs flex items-center gap-1">
            {getTypeIcon(result.type)}
          </Badge>
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{result.name}</h4>
            {result.venue && (
              <p className="text-xs text-muted-foreground truncate">{result.venue}</p>
            )}
            {result.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {result.description}
              </p>
            )}
            
            {/* Enhanced metadata display */}
            <div className="flex flex-wrap gap-2 mt-2">
              {renderMetadata()}
            </div>
          </div>
          
          <Badge variant="outline" className="text-xs shrink-0">
            {result.api_source === 'omdb' ? 'IMDb' : 
             result.api_source === 'google_books' ? 'Books' :
             result.api_source === 'google_places' ? 'Places' :
             result.api_source}
          </Badge>
        </div>
      </div>
    </div>
  );
}
