
import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LocationResult {
  name: string;
  venue: string | null;
  api_ref: string;
  metadata: {
    location: {
      lat: number;
      lng: number;
    };
  };
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
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: { query: searchQuery }
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

  const handleSelectLocation = (result: LocationResult) => {
    const locationData = {
      name: result.name,
      address: result.venue || '',
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
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-background border rounded-md shadow-lg">
          {results.map((result, index) => (
            <div
              key={result.api_ref || index}
              className="px-3 py-2 hover:bg-accent cursor-pointer"
              onClick={() => handleSelectLocation(result)}
            >
              <div className="font-medium">{result.name}</div>
              {result.venue && (
                <div className="text-xs text-muted-foreground">{result.venue}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
