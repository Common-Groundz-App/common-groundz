import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { ProductSearchResult } from '@/hooks/use-unified-search';
import { useToast } from '@/hooks/use-toast';
import { Entity } from '@/services/recommendation/types';
import { createEnhancedEntity } from '@/services/enhancedEntityService';
import { findEntityByApiRef } from '@/services/recommendation/entityOperations';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EntityCategory } from '@/utils/loadingMessages';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface SearchResultHandlerProps {
  result: ProductSearchResult;
  query: string;
  onClose?: () => void;
  isProcessing: boolean;
  onProcessingStart: (entityName: string, message: string) => void;
  onProcessingUpdate: (message: string) => void;
  onProcessingEnd: () => void;
}

export function SearchResultHandler({ 
  result, 
  query, 
  onClose, 
  isProcessing,
  onProcessingStart,
  onProcessingUpdate,
  onProcessingEnd
}: SearchResultHandlerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Determine entity type based on result data or use 'product' as default
  const entityType: EntityTypeString = determineEntityType(result);

  const handleResultClick = async () => {
    // Prevent multiple clicks during processing
    if (isProcessing) return;
    
    try {
      // Set engaging loading message based on entity type
      const initialMessage = getEngagingLoadingMessage(entityType, result.name);
      onProcessingStart(result.name, initialMessage);
      
      console.log(`🔍 Processing search result:`, result);
      
      // First, check if entity already exists
      let existingEntity: Entity | null = null;
      if (result.api_source && result.api_ref) {
        existingEntity = await findEntityByApiRef(result.api_source, result.api_ref);
      }
      
      if (existingEntity) {
        console.log(`✅ Found existing entity: ${existingEntity.name} (${existingEntity.id})`);
        
        // Update loading message for existing entity
        onProcessingUpdate(getNavigationMessage(entityType, result.name));
        
        // Keep the loading state active for smooth transition
        setTimeout(() => {
          const identifier = existingEntity.slug || existingEntity.id;
          const entityPath = `/entity/${identifier}`;
          
          console.log(`🔗 Navigating to existing entity: ${entityPath}`);
          navigate(entityPath);
          
          if (onClose) {
            onClose();
          }
          
          onProcessingEnd();
        }, 1200); // Slightly longer delay for better UX
        
        return;
      }
      
      // If no existing entity, create new one
      console.log(`🆕 Creating new entity from search result`);
      onProcessingUpdate(getCreationMessage(entityType, result.name));
      
      // Prepare enhanced data for entity creation
      const enhancedResultData = {
        ...result,
        type: entityType,
        metadata: {
          ...result.metadata,
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
          ...(result.api_source === 'omdb' && {
            director: result.metadata?.director,
            cast: result.metadata?.cast,
            runtime: result.metadata?.runtime,
            genres: result.metadata?.genres,
            imdb_rating: result.metadata?.imdb_rating,
            year: result.metadata?.year
          }),
          ...(result.api_source === 'google_books' && {
            authors: result.metadata?.authors,
            publication_year: result.metadata?.publication_year,
            isbn: result.metadata?.isbn,
            publisher: result.metadata?.publisher,
            page_count: result.metadata?.page_count,
            languages: result.metadata?.languages
          })
        }
      };
      
      // Use enhanced entity service to create entity with rich metadata
      const entity = await createEnhancedEntity(enhancedResultData, entityType);
      
      if (entity) {
        console.log(`✅ Enhanced entity created successfully:`, entity);
        
        // Keep the loading state active for a moment to ensure smooth transition
        setTimeout(() => {
          const identifier = entity.slug || entity.id;
          const entityPath = `/entity/${identifier}`;
          
          console.log(`🔗 Navigating to new entity page: ${entityPath}`);
          navigate(entityPath);
          
          if (onClose) {
            onClose();
          }
          
          onProcessingEnd();
        }, 800);
        
      } else {
        console.error('❌ Enhanced entity creation failed - no entity returned');
        toast({
          title: 'Error',
          description: 'Could not process this item. Please try again.',
          variant: 'destructive'
        });
        onProcessingEnd();
      }
    } catch (error) {
      console.error('❌ Error handling search result:', error);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive'
      });
      onProcessingEnd();
    }
  };

  return (
    <div 
      className={`flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-all duration-200 ${
        isProcessing ? 'opacity-50 bg-muted/30 pointer-events-none' : 'hover:scale-[1.02]'
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
        {isProcessing && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
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
      {isProcessing && (
        <div className="flex-shrink-0">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
  );
}

// Helper functions for engaging messages
function getEngagingLoadingMessage(type: EntityTypeString, name: string): string {
  const messages = {
    movie: [
      `🎬 Exploring this incredible film...`,
      `🍿 Getting ready for movie night...`,
      `🎭 Discovering cinematic magic...`
    ],
    book: [
      `📚 Diving into this amazing story...`,
      `✨ Exploring literary excellence...`,
      `📖 Preparing your next great read...`
    ],
    place: [
      `🗺️ Exploring this amazing destination...`,
      `🌟 Discovering what makes this place special...`,
      `📍 Preparing your next adventure...`
    ],
    food: [
      `🍽️ Exploring this delicious experience...`,
      `👨‍🍳 Discovering culinary excellence...`,
      `🌟 Preparing a feast for your senses...`
    ],
    product: [
      `🛍️ Exploring this amazing item...`,
      `✨ Discovering product details...`,
      `🌟 Preparing something special...`
    ]
  };
  
  const typeMessages = messages[type as keyof typeof messages] || messages.product;
  return typeMessages[Math.floor(Math.random() * typeMessages.length)];
}

function getNavigationMessage(type: EntityTypeString, name: string): string {
  const messages = {
    movie: `🎬 Taking you to this amazing film...`,
    book: `📚 Opening this incredible book...`,
    place: `🗺️ Taking you to this wonderful place...`,
    food: `🍽️ Taking you to this delicious experience...`,
    product: `🛍️ Exploring this amazing item...`
  };
  
  return messages[type as keyof typeof messages] || `✨ Taking you there...`;
}

function getCreationMessage(type: EntityTypeString, name: string): string {
  const messages = {
    movie: `🎬 Adding this film to your collection...`,
    book: `📚 Adding this book to your library...`,
    place: `🗺️ Adding this place to your map...`,
    food: `🍽️ Adding this spot to your favorites...`,
    product: `🛍️ Adding this to your collection...`
  };
  
  return messages[type as keyof typeof messages] || `✨ Creating your personalized experience...`;
}

// Helper function to determine entity type from search result
function determineEntityType(result: ProductSearchResult): EntityTypeString {
  // PRIORITY 1: Check API source for definitive type mapping
  if (result.api_source === 'openlibrary' || result.api_source === 'google_books') {
    return 'book';
  }
  
  if (result.api_source === 'omdb' || result.api_source === 'tmdb') {
    return 'movie';
  }
  
  if (result.api_source === 'google_places') {
    return 'place';
  }
  
  // PRIORITY 2: Check metadata for specific type indicators
  if (result.metadata?.authors || result.metadata?.isbn || result.metadata?.publication_year) {
    return 'book';
  }
  
  if (result.metadata?.director || result.metadata?.cast || result.metadata?.runtime || result.metadata?.imdb_rating) {
    return 'movie';
  }
  
  if (result.metadata?.formatted_address || result.metadata?.place_id) {
    return 'place';
  }
  
  // PRIORITY 3: Check venue or description for clues
  if (result.venue && (
    result.venue.toLowerCase().includes('restaurant') ||
    result.venue.toLowerCase().includes('cafe') ||
    result.venue.toLowerCase().includes('food')
  )) {
    return 'food';
  }
  
  // PRIORITY 4: Check for content-related keywords in the name or description
  const text = `${result.name} ${result.description || ''}`.toLowerCase();
  
  if (text.includes('book') || text.includes('author') || text.includes('novel') || 
      text.includes('paperback') || text.includes('hardcover') || text.includes('isbn')) {
    return 'book';
  }
  
  if (text.includes('movie') || text.includes('film') || text.includes('cinema') ||
      text.includes('director') || text.includes('actor')) {
    return 'movie';
  }
  
  if (text.includes('restaurant') || text.includes('cafe') || text.includes('food') ||
      text.includes('cuisine') || text.includes('dining')) {
    return 'food';
  }
  
  // Default to product for shopping/commercial results
  return 'product';
}
