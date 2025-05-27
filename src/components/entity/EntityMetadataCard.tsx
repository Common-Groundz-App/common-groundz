import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Entity } from '@/services/recommendation/types';
import { Book, Film, MapPin, Package, Star, Calendar, User, Globe, Phone, Clock } from 'lucide-react';

interface EntityMetadataCardProps {
  entity: Entity;
}

export const EntityMetadataCard: React.FC<EntityMetadataCardProps> = ({ entity }) => {
  const renderBookMetadata = () => {
    // Enhanced fallback logic for book metadata
    const authors = entity.authors || 
                   (entity.metadata?.authors && Array.isArray(entity.metadata.authors) ? entity.metadata.authors : []) ||
                   (entity.venue && entity.api_source === 'openlibrary' ? [entity.venue] : []);
    
    const publicationYear = entity.publication_year || 
                           entity.metadata?.publication_year || 
                           entity.metadata?.first_publish_year;
    
    const isbn = entity.isbn || entity.metadata?.isbn || entity.metadata?.isbn_13 || entity.metadata?.isbn_10;
    
    const pageCount = entity.specifications?.page_count || 
                     entity.metadata?.page_count || 
                     entity.metadata?.number_of_pages_median;
    
    const publisher = entity.specifications?.publisher || entity.metadata?.publisher;
    
    const languages = entity.languages || 
                     (entity.metadata?.languages && Array.isArray(entity.metadata.languages) ? entity.metadata.languages : []);

    return (
      <div className="space-y-3">
        {authors && authors.length > 0 && (
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Authors</div>
              <div className="text-sm text-muted-foreground">
                {authors.join(', ')}
              </div>
            </div>
          </div>
        )}
        
        {publicationYear && (
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Published</div>
              <div className="text-sm text-muted-foreground">{publicationYear}</div>
            </div>
          </div>
        )}
        
        {isbn && (
          <div className="flex items-start gap-2">
            <Book className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">ISBN</div>
              <div className="text-sm text-muted-foreground">{isbn}</div>
            </div>
          </div>
        )}
        
        {pageCount && (
          <div className="flex items-start gap-2">
            <Book className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Pages</div>
              <div className="text-sm text-muted-foreground">{pageCount}</div>
            </div>
          </div>
        )}
        
        {publisher && (
          <div className="flex items-start gap-2">
            <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Publisher</div>
              <div className="text-sm text-muted-foreground">{publisher}</div>
            </div>
          </div>
        )}
        
        {languages && languages.length > 0 && (
          <div className="flex items-start gap-2">
            <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Languages</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {languages.map((lang, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMovieMetadata = () => (
    <div className="space-y-3">
      {entity.publication_year && (
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Release Year</div>
            <div className="text-sm text-muted-foreground">{entity.publication_year}</div>
          </div>
        </div>
      )}
      
      {entity.cast_crew?.director && (
        <div className="flex items-start gap-2">
          <Film className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Director</div>
            <div className="text-sm text-muted-foreground">{entity.cast_crew.director}</div>
          </div>
        </div>
      )}
      
      {entity.cast_crew?.cast && entity.cast_crew.cast.length > 0 && (
        <div className="flex items-start gap-2">
          <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Cast</div>
            <div className="text-sm text-muted-foreground">
              {entity.cast_crew.cast.slice(0, 3).join(', ')}
              {entity.cast_crew.cast.length > 3 && ` +${entity.cast_crew.cast.length - 3} more`}
            </div>
          </div>
        </div>
      )}
      
      {entity.specifications?.runtime && (
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Runtime</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.runtime} minutes</div>
          </div>
        </div>
      )}
      
      {entity.specifications?.genres && entity.specifications.genres.length > 0 && (
        <div className="flex items-start gap-2">
          <Film className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Genres</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {entity.specifications.genres.map((genre: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {genre}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPlaceMetadata = () => (
    <div className="space-y-3">
      {entity.specifications?.address && (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Address</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.address}</div>
          </div>
        </div>
      )}
      
      {entity.specifications?.phone && (
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Phone</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.phone}</div>
          </div>
        </div>
      )}
      
      {entity.specifications?.website && (
        <div className="flex items-start gap-2">
          <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Website</div>
            <a 
              href={entity.specifications.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Visit Website
            </a>
          </div>
        </div>
      )}
      
      {entity.specifications?.types && entity.specifications.types.length > 0 && (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Categories</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {entity.specifications.types.slice(0, 3).map((type: string, index: number) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {type.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderProductMetadata = () => (
    <div className="space-y-3">
      {entity.price_info?.price && (
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Price</div>
            <div className="text-sm text-muted-foreground">
              {entity.price_info.currency || '$'}{entity.price_info.price}
            </div>
          </div>
        </div>
      )}
      
      {entity.specifications?.brand && (
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Brand</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.brand}</div>
          </div>
        </div>
      )}
      
      {entity.specifications?.model && (
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Model</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.model}</div>
          </div>
        </div>
      )}
      
      {entity.specifications?.category && (
        <div className="flex items-start gap-2">
          <Package className="h-4 w-4 mt-0.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">Category</div>
            <div className="text-sm text-muted-foreground">{entity.specifications.category}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderExternalRatings = () => {
    if (!entity.external_ratings || Object.keys(entity.external_ratings).length === 0) {
      return null;
    }

    return (
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Star className="h-4 w-4" />
            External Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(entity.external_ratings).map(([source, rating]) => {
            if (!rating || rating === null) return null;
            
            return (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">
                  {source.replace(/_/g, ' ')}
                </span>
                <Badge variant="outline">
                  {typeof rating === 'number' ? rating.toFixed(1) : rating}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  const getMetadataContent = () => {
    switch (entity.type) {
      case 'book':
        return renderBookMetadata();
      case 'movie':
        return renderMovieMetadata();
      case 'place':
        return renderPlaceMetadata();
      case 'product':
        return renderProductMetadata();
      default:
        return (
          <div className="text-sm text-muted-foreground">
            No specific metadata available for this entity type.
          </div>
        );
    }
  };

  return (
    <div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {getMetadataContent()}
        </CardContent>
      </Card>
      
      {renderExternalRatings()}
    </div>
  );
};
