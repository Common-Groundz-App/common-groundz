import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { ProductSearchResult } from '@/hooks/use-unified-search';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';
import { createEnhancedEntity } from '@/services/enhancedEntityService';
import { LoadingSpinner, EntityCreationLoader } from '@/components/ui/loading-spinner';
import { EntityCategory } from '@/utils/loadingMessages';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface SearchResultHandlerProps {
  result: ProductSearchResult;
  query: string;
  onClose?: () => void;
}

export function SearchResultHandler({ result, query, onClose }: SearchResultHandlerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  
  // Determine entity type based on result data or use 'product' as default
  const entityType: EntityTypeString = determineEntityType(result);

  const handleResultClick = async () => {
    try {
      setIsCreatingEntity(true);
      console.log(`🔍 Creating enhanced entity from search result:`, result);
      
      // Prepare enhanced data for entity creation
      const enhancedResultData = {
        ...result,
        // Ensure metadata is properly structured
        metadata: {
          ...result.metadata,
          // For books, ensure we capture all the enhanced metadata from Open Library
          ...(result.api_source === 'openlibrary' && {
            authors: result.metadata?.authors,
            publication_year: result.metadata?.publication_year || result.metadata?.first_publish_year,
            isbn: result.metadata?.isbn,
            publisher: result.metadata?.publisher,
            page_count: result.metadata?.page_count || result.metadata?.number_of_pages_median,
            languages: result.metadata?.languages,
            subjects: result.metadata?.subjects,
            edition_count: result.metadata?.edition_count
          }),
          // For movies, ensure we capture OMDB enhanced metadata
          ...(result.api_source === 'omdb' && {
            director: result.metadata?.director,
            cast: result.metadata?.cast,
            runtime: result.metadata?.runtime,
            genres: result.metadata?.genres,
            imdb_rating: result.metadata?.imdb_rating,
            year: result.metadata?.year
          })
        }
      };
      
      // Use enhanced entity service to create entity with rich metadata
      const entity = await createEnhancedEntity(enhancedResultData, entityType);
      
      if (entity) {
        console.log(`✅ Enhanced entity created successfully:`, entity);
        
        // Always navigate to the standardized entity URL using slug
        const identifier = entity.slug || entity.id;
        const entityPath = `/entity/${identifier}`;
        
        console.log(`🔗 Navigating to entity page: ${entityPath}`);
        navigate(entityPath);
        
        if (onClose) {
          onClose();
        }
      } else {
        console.error('❌ Enhanced entity creation failed - no entity returned');
        toast({
          title: 'Error',
          description: 'Could not create entity from this result',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('❌ Error handling search result:', error);
      toast({
        title: 'Error',
        description: 'Failed to process search result',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingEntity(false);
    }
  };

  // Convert entity type to category for loading messages
  const getEntityCategory = (type: EntityTypeString): EntityCategory => {
    const categoryMap: Record<EntityTypeString, EntityCategory> = {
      'book': 'book',
      'movie': 'movie',
      'place': 'place',
      'food': 'food',
      'product': 'product',
      'music': 'music',
      'tv': 'tv',
      'art': 'art',
      'activity': 'activity',
      'drink': 'drink',
      'travel': 'travel'
    };
    
    return categoryMap[type] || 'product';
  };

  return (
    <>
      <div 
        className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-all duration-200 ${
          isCreatingEntity ? 'opacity-50 pointer-events-none' : 'hover:scale-[1.02]'
        }`}
        onClick={handleResultClick}
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative group">
          {result.image_url ? (
            <ImageWithFallback
              src={result.image_url} 
              alt={result.name}
              entityType={entityType}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No Image
            </div>
          )}
          {isCreatingEntity && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <LoadingSpinner size="sm" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{result.name}</h3>
          <p className="text-xs text-muted-foreground truncate">{result.venue}</p>
          {result.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {result.description}
            </p>
          )}
          {result.metadata?.price && (
            <p className="text-xs font-medium text-green-600 mt-1">
              {result.metadata.price}
            </p>
          )}
          <div className="mt-1">
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
              {entityType}
            </span>
          </div>
        </div>
        {isCreatingEntity && (
          <div className="flex-shrink-0">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {/* Loading Modal */}
      <Dialog open={isCreatingEntity} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <EntityCreationLoader 
            entityName={result.name} 
            category={getEntityCategory(entityType)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// Helper function to determine entity type from search result
function determineEntityType(result: ProductSearchResult): EntityTypeString {
  // Check if api_source gives us a hint about the type
  if (result.api_source === 'openlibrary') {
    return 'book';
  }
  
  if (result.api_source === 'google_places') {
    return 'place';
  }
  
  if (result.api_source === 'tmdb') {
    return 'movie';
  }
  
  // Check venue or metadata for clues
  if (result.venue && (
    result.venue.toLowerCase().includes('restaurant') ||
    result.venue.toLowerCase().includes('cafe') ||
    result.venue.toLowerCase().includes('food')
  )) {
    return 'food';
  }
  
  // Check for book-related keywords in the name or description
  const text = `${result.name} ${result.description || ''}`.toLowerCase();
  if (text.includes('book') || text.includes('author') || text.includes('novel') || text.includes('paperback') || text.includes('hardcover')) {
    return 'book';
  }
  
  // Default to product for shopping/commercial results
  return 'product';
}
