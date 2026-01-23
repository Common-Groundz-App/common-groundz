
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, AlertCircle, Sparkles, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUnifiedSearch } from '@/hooks/use-unified-search';
import { SearchResultHandler } from '@/components/search/SearchResultHandler';
import { getEntityUrlWithParent } from '@/utils/entityUrlUtils';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';

export default function ProductSearch() {
  const { query } = useParams<{ query: string }>();
  const navigate = useNavigate();
  const decodedQuery = decodeURIComponent(query || '');
  
  // Use unified search to get product results
  const { results, isLoading, error } = useUnifiedSearch(decodedQuery, { skipProductSearch: false });

  if (!query) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Invalid Search</h1>
            <Button onClick={() => navigate('/search')}>
              Go Back to Search
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/search')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold truncate">
                Results for "{decodedQuery}"
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-muted-foreground">Searching for the best results...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <div>
                <h3 className="font-medium text-destructive">Search Error</h3>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!isLoading && !error && (
          <div className="space-y-6">
            {/* Database Entities */}
            {results.entities.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">From CommonGroundz</CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {results.entities.length} found
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {results.entities.map((entity) => (
                    <div 
                      key={entity.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
                      onClick={() => navigate(getEntityUrlWithParent(entity))}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {getOptimalEntityImageUrl(entity) ? (
                          <img 
                            src={getOptimalEntityImageUrl(entity) || ''} 
                            alt={entity.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                            {entity.type[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{entity.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{entity.venue}</p>
                        {entity.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {entity.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getEntityTypeLabel(entity.type)}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* External Products */}
            {results.products.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-orange-500" />
                    <CardTitle className="text-lg">From the Web</CardTitle>
                    <Badge variant="secondary" className="ml-auto">
                      {results.products.length} found
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Click any result to create an entity and start reviewing!
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {results.products.map((product, index) => (
                    <SearchResultHandler
                      key={`${product.api_source}-${product.api_ref}-${index}`}
                      result={product}
                      query={decodedQuery}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No Results */}
            {!isLoading && results.entities.length === 0 && results.products.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Results Found</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn't find any results matching "{decodedQuery}"
                  </p>
                  <Button onClick={() => navigate('/search')} variant="outline">
                    Try a Different Search
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
