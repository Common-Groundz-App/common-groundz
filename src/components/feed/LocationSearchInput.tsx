
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, MapPin, Loader2, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/use-geolocation';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface LocationResult {
  name: string;
  venue: string | null;
  api_ref: string;
  metadata: {
    location: {
      lat: number;
      lng: number;
    };
    formatted_address?: string;
    distance?: number;
    photos?: { photo_reference: string }[];
  };
  image_url?: string;
}

interface LocationSearchInputProps {
  onLocationSelect: (location: { name: string; address: string; placeId: string; coordinates: { lat: number; lng: number } }) => void;
  onClear: () => void;
  initialLocation?: string;
  className?: string;
}

export function LocationSearchInput({ onLocationSelect, onClear, initialLocation = '', className = '' }: LocationSearchInputProps) {
  const [query, setQuery] = useState(initialLocation);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get geolocation data
  const { 
    position, 
    error: geoError, 
    isLoading: geoLoading, 
    getPosition, 
    isGeolocationSupported,
    formatDistance
  } = useGeolocation();

  // Handle click outside to close results dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle search with debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(query);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  const searchPlaces = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      // Include position if available
      const payload: {
        query: string;
        latitude?: number;
        longitude?: number;
      } = { query: searchQuery };
      
      if (position) {
        payload.latitude = position.latitude;
        payload.longitude = position.longitude;
      }
      
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: payload
      });
      
      if (error) throw error;
      
      if (data && data.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      toast({
        title: 'Search failed',
        description: 'Could not search for places. Please try again.',
        variant: 'destructive'
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchNearby = async () => {
    if (!position) {
      getPosition();
      return;
    }
    
    setIsLoading(true);
    setShowResults(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: { 
          latitude: position.latitude,
          longitude: position.longitude
        }
      });
      
      if (error) throw error;
      
      if (data && data.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error finding nearby places:', error);
      toast({
        title: 'Search failed',
        description: 'Could not find nearby places. Please try again.',
        variant: 'destructive'
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectLocation = (result: LocationResult) => {
    const locationData = {
      name: result.name,
      address: result.metadata.formatted_address || '',
      placeId: result.api_ref,
      coordinates: result.metadata.location
    };
    
    onLocationSelect(locationData);
    setQuery(result.name);
    setShowResults(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onClear();
  };

  const handleUseMyLocation = () => {
    if (!isGeolocationSupported) {
      toast({
        title: 'Not supported',
        description: 'Geolocation is not supported in your browser.',
        variant: 'destructive'
      });
      return;
    }
    
    if (geoLoading) return;
    
    if (position) {
      searchNearby();
    } else {
      getPosition();
    }
  };

  // When position becomes available and the user requested it, search nearby
  useEffect(() => {
    if (geoLoading && position) {
      searchNearby();
    }
  }, [position, geoLoading]);

  // If there was an error getting location
  useEffect(() => {
    if (geoError) {
      toast({
        title: 'Location error',
        description: geoError.message || 'Could not access your location. Please check your browser settings.',
        variant: 'destructive'
      });
    }
  }, [geoError, toast]);

  // Get the image URL for a result
  const getImageUrl = (result: LocationResult) => {
    // First try to use direct image_url if available
    if (result.image_url) return result.image_url;
    
    // For Google Places results, check if there are photo references
    if (result.metadata?.photos && result.metadata.photos.length > 0) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=100&photoreference=${
        result.metadata.photos[0].photo_reference
      }&key=YOUR_API_KEY`;
      // Note: In production, you would use the actual API key here, or preferably call your
      // Supabase function to proxy the image request instead of exposing the API key
    }
    
    return null;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="relative flex-1">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a location..."
            className="bg-transparent border-b border-l-0 border-r-0 border-t-0 rounded-none px-0 h-8 focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
            onFocus={() => query.length >= 2 && setShowResults(true)}
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        
        {/* Near me button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="h-6 w-6 p-0"
          title="Use my location"
        >
          {geoLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {showResults && results.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full max-h-60 overflow-auto bg-background border rounded-md shadow-lg location-search-dropdown">
          {results.map((result, index) => (
            <div
              key={result.api_ref || index}
              className="px-3 py-2 hover:bg-accent cursor-pointer flex items-start gap-2"
              onClick={() => handleSelectLocation(result)}
            >
              {/* Image thumbnail */}
              <div className="flex-shrink-0">
                <ImageWithFallback
                  src={getImageUrl(result)}
                  alt={result.name}
                  className="w-12 h-12 object-cover rounded-md bg-gray-100"
                  fallbackSrc="https://images.unsplash.com/photo-1495195134817-aeb325a55b65?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
                />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{result.name}</div>
                {result.metadata.formatted_address && (
                  <div className="text-xs text-muted-foreground">{result.metadata.formatted_address}</div>
                )}
                {result.metadata.distance !== undefined && (
                  <div className="text-xs text-brand-orange font-medium mt-1">
                    {formatDistance(result.metadata.distance)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
