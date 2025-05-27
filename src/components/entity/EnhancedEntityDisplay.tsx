
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MapPin, Calendar, Users, Book, Film, Clock } from 'lucide-react';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface EnhancedEntityDisplayProps {
  entity: any;
}

export const EnhancedEntityDisplay = ({ entity }: EnhancedEntityDisplayProps) => {
  const renderTypeIcon = () => {
    switch (entity.type) {
      case 'book': return <Book className="w-5 h-5" />;
      case 'movie': return <Film className="w-5 h-5" />;
      case 'place': return <MapPin className="w-5 h-5" />;
      default: return null;
    }
  };

  const renderBookDetails = () => {
    if (entity.type !== 'book') return null;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-5 h-5" />
            Book Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entity.authors && entity.authors.length > 0 && (
            <div>
              <span className="font-medium">Authors: </span>
              <span>{entity.authors.join(', ')}</span>
            </div>
          )}
          {entity.publication_year && (
            <div>
              <span className="font-medium">Published: </span>
              <span>{entity.publication_year}</span>
            </div>
          )}
          {entity.isbn && (
            <div>
              <span className="font-medium">ISBN: </span>
              <span className="font-mono text-sm">{entity.isbn}</span>
            </div>
          )}
          {entity.languages && entity.languages.length > 0 && (
            <div>
              <span className="font-medium">Languages: </span>
              <span>{entity.languages.join(', ')}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMovieDetails = () => {
    if (entity.type !== 'movie') return null;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            Movie Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entity.cast_crew?.director && (
            <div>
              <span className="font-medium">Director: </span>
              <span>{entity.cast_crew.director}</span>
            </div>
          )}
          {entity.cast_crew?.actors && (
            <div>
              <span className="font-medium">Cast: </span>
              <span>{entity.cast_crew.actors}</span>
            </div>
          )}
          {entity.specifications?.runtime && (
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{entity.specifications.runtime} minutes</span>
            </div>
          )}
          {entity.specifications?.release_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(entity.specifications.release_date).getFullYear()}</span>
            </div>
          )}
          {entity.specifications?.genres && (
            <div className="flex flex-wrap gap-1">
              {entity.specifications.genres.map((genre: string, index: number) => (
                <Badge key={index} variant="secondary">{genre}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPlaceDetails = () => {
    if (entity.type !== 'place') return null;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Place Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {entity.venue && (
            <div>
              <span className="font-medium">Address: </span>
              <span>{entity.venue}</span>
            </div>
          )}
          {entity.specifications?.phone && (
            <div>
              <span className="font-medium">Phone: </span>
              <span>{entity.specifications.phone}</span>
            </div>
          )}
          {entity.specifications?.website && (
            <div>
              <span className="font-medium">Website: </span>
              <a 
                href={entity.specifications.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Visit Website
              </a>
            </div>
          )}
          {entity.specifications?.place_types && (
            <div className="flex flex-wrap gap-1">
              {entity.specifications.place_types.slice(0, 5).map((type: string, index: number) => (
                <Badge key={index} variant="outline">
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderRatings = () => {
    if (!entity.external_ratings || Object.keys(entity.external_ratings).length === 0) {
      return null;
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Ratings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(entity.external_ratings).map(([source, rating]) => {
            if (!rating) return null;
            return (
              <div key={source} className="flex justify-between items-center">
                <span className="font-medium capitalize">{source}:</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span>{rating}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Image */}
        <div className="flex-shrink-0">
          <ImageWithFallback
            src={entity.image_url}
            alt={entity.name}
            className="w-full md:w-64 h-80 object-cover rounded-lg border"
            fallbackSrc="https://images.unsplash.com/photo-1495195134817-aeb325a55b65?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80"
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {renderTypeIcon()}
              <h1 className="text-3xl font-bold">{entity.name}</h1>
            </div>
            {entity.venue && (
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {entity.venue}
              </p>
            )}
          </div>
          
          {entity.description && (
            <p className="text-gray-700 leading-relaxed">{entity.description}</p>
          )}
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {entity.type}
            </Badge>
            {entity.api_source && (
              <Badge variant="outline">
                {entity.api_source}
              </Badge>
            )}
            {entity.popularity_score > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Popular
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {renderBookDetails()}
        {renderMovieDetails()}
        {renderPlaceDetails()}
        {renderRatings()}
      </div>

      {/* Additional Metadata */}
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm bg-muted p-3 rounded overflow-auto max-h-60">
              {Object.entries(entity.metadata).map(([key, value]) => (
                <div key={key} className="mb-2">
                  <span className="font-medium">{key}: </span>
                  <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
