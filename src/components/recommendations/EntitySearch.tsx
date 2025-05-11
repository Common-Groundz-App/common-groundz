
import React, { useState, useEffect } from 'react';
import { Entity, EntityType } from '@/services/recommendation/types';
import { Search, Book, Film, MapPin, ShoppingBag, Coffee, Globe, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useEntitySearch } from '@/hooks/use-entity-search';
import { Badge } from '@/components/ui/badge';
import { useLocation } from '@/contexts/LocationContext';

interface EntitySearchProps {
  type: EntityType;
  onSelect: (entity: Entity) => void;
}

export function EntitySearch({ type, onSelect }: EntitySearchProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'url'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  const {
    localResults,
    externalResults,
    isLoading,
    handleSearch,
    createEntityFromUrl,
    createEntityFromExternal,
  } = useEntitySearch(type);
  
  const {
    position,
    isLoading: geoLoading,
    getPosition,
    isGeolocationSupported,
    formatDistance,
    locationEnabled,
    enableLocation,
    disableLocation,
    permissionStatus
  } = useLocation();

  // Handler functions for selecting entities
  const handleSelectEntity = (entity: Entity) => {
    onSelect(entity);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleSelectExternal = async (result: any) => {
    const entity = await createEntityFromExternal(result);
    if (entity) {
      onSelect(entity);
      setSearchQuery('');
      setShowResults(false);
    }
  };

  // Show/hide results based on search activity
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [searchQuery]);
  
  // When location or search query changes, perform search
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      handleSearch(searchQuery, locationEnabled, position);
    }
  }, [locationEnabled, position, searchQuery]);

  // Get the appropriate icon based on entity type
  const getEntityIcon = () => {
    switch (type) {
      case 'book':
        return <Book className="h-4 w-4" />;
      case 'movie':
        return <Film className="h-4 w-4" />;
      case 'place':
        return <MapPin className="h-4 w-4" />;
      case 'product':
        return <ShoppingBag className="h-4 w-4" />;
      case 'food':
        return <Coffee className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  // Get appropriate placeholder text based on entity type
  const getPlaceholderText = () => {
    switch (type) {
      case 'place':
        return 'Search for place or restaurant...';
      case 'food':
        return 'Search for restaurant...';
      case 'movie':
        return 'Search for movie...';
      case 'book':
        return 'Search for book...';
      case 'product':
        return 'Search for product...';
      default:
        return `Search for ${type}...`;
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    
    const entity = await createEntityFromUrl(urlInput);
    if (entity) {
      onSelect(entity);
      setUrlInput('');
      setActiveTab('search');
    }
  };
  
  // Toggle location-based search
  const toggleLocationSearch = () => {
    if (!isGeolocationSupported) return;
    
    if (locationEnabled) {
      disableLocation();
    } else {
      enableLocation();
    }
  };
  
  // Get button state based on permission status
  const getLocationButtonState = () => {
    if (!isGeolocationSupported) return { disabled: true, text: "Location not supported" };
    
    if (geoLoading) return { disabled: true, text: "Getting location..." };
    
    if (permissionStatus === 'denied') {
      return { 
        disabled: false, 
        text: "Location access denied",
        action: () => alert("Please enable location access in your browser settings")
      };
    }
    
    if (locationEnabled && position) {
      return { disabled: false, text: "Near me", action: toggleLocationSearch };
    }
    
    return { disabled: false, text: "Use my location", action: toggleLocationSearch };
  };
  
  const buttonState = getLocationButtonState();

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <Tabs value={activeTab} onValueChange={(value: 'search' | 'url') => setActiveTab(value)}>
        <TabsList className="mb-4">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="url">Add from URL</TabsTrigger>
        </TabsList>

        <TabsContent value="search">
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder={getPlaceholderText()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery, locationEnabled, position)}
                  className="pr-8"
                />
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                  {getEntityIcon()}
                </div>
              </div>
              <Button 
                type="button" 
                onClick={() => handleSearch(searchQuery, locationEnabled, position)} 
                disabled={!searchQuery.trim()}
              >
                Search
              </Button>
            </div>
            
            {/* Location toggle button - only for place or food */}
            {(type === 'place' || type === 'food') && isGeolocationSupported && (
              <div className="flex items-center justify-between mt-2">
                <Button
                  type="button"
                  variant={locationEnabled ? "secondary" : "outline"}
                  size="sm"
                  className="flex items-center gap-1 text-xs h-8"
                  onClick={buttonState.action || toggleLocationSearch}
                  disabled={buttonState.disabled}
                >
                  <Navigation className={`h-3.5 w-3.5 ${geoLoading ? 'animate-pulse' : ''}`} />
                  {buttonState.text}
                </Button>
                
                {locationEnabled && position && (
                  <Badge variant="outline" className="text-xs bg-accent/30 border-none">
                    Using your location
                  </Badge>
                )}
              </div>
            )}

            {showResults && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-64 overflow-y-auto">
                {isLoading || geoLoading ? (
                  <div className="p-2 space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <>
                    {localResults.length === 0 && externalResults.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No results found
                      </div>
                    )}
                    
                    {localResults.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                          Previous Recommendations
                        </div>
                        {localResults.map((entity) => (
                          <div
                            key={entity.id}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => handleSelectEntity(entity)}
                          >
                            <div className="font-medium">{entity.name}</div>
                            {entity.venue && (
                              <div className="text-xs text-gray-500">{entity.venue}</div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                    
                    {externalResults.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                          External Results
                        </div>
                        {externalResults.map((result, idx) => (
                          <div
                            key={`${result.api_source}-${result.api_ref || idx}`}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => handleSelectExternal(result)}
                          >
                            <div className="font-medium">{result.name}</div>
                            {result.venue && (
                              <div className="text-xs text-gray-500">{result.venue}</div>
                            )}
                            {result.description && (
                              <div className="text-xs text-gray-600 truncate">{result.description}</div>
                            )}
                            {/* Show distance if available */}
                            {result.metadata?.distance !== undefined && locationEnabled && (
                              <div className="text-xs text-brand-orange font-medium mt-1">
                                {formatDistance(result.metadata.distance)}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="url"
                placeholder="Enter website URL..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                className="pr-8"
              />
              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <Button 
              type="button" 
              onClick={handleUrlSubmit} 
              disabled={!urlInput.trim()}
            >
              Add
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EntitySearch;
