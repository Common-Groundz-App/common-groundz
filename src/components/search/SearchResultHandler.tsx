
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { ProductSearchResult } from '@/hooks/use-unified-search';
import { useToast } from '@/hooks/use-toast';

interface SearchResultHandlerProps {
  result: ProductSearchResult;
  query: string;
  onClose?: () => void;
}

export function SearchResultHandler({ result, query, onClose }: SearchResultHandlerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Determine entity type based on result data or use 'product' as default
  const entityType: EntityTypeString = determineEntityType(result);
  const { createEntityFromExternal } = useEntitySearch(entityType);

  const handleResultClick = async () => {
    try {
      // Convert search result to external data format for entity creation
      const externalData = {
        name: result.name,
        venue: result.venue,
        description: result.description,
        image_url: result.image_url,
        api_source: result.api_source,
        api_ref: result.api_ref,
        metadata: {
          ...result.metadata,
          purchase_url: result.metadata?.purchase_url,
          price: result.metadata?.price,
          rating: result.metadata?.rating,
          seller: result.metadata?.seller
        }
      };

      // Create entity from the search result
      const entity = await createEntityFromExternal(externalData);
      
      if (entity) {
        // Navigate to the entity page using the proper URL structure
        // Use slug if available, otherwise fall back to id
        const identifier = entity.slug || entity.id;
        const entityPath = `/${entityType}/${identifier}`;
        navigate(entityPath);
        
        if (onClose) {
          onClose();
        }
      } else {
        toast({
          title: 'Error',
          description: 'Could not create entity from this result',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error handling search result:', error);
      toast({
        title: 'Error',
        description: 'Failed to process search result',
        variant: 'destructive'
      });
    }
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
      onClick={handleResultClick}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {result.image_url ? (
          <img 
            src={result.image_url} 
            alt={result.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No Image
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
      </div>
    </div>
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
  
  // Default to product for shopping/commercial results
  return 'product';
}
