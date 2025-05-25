
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { cn } from '@/lib/utils';
import { ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown, Star, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface ProductSearchResult {
  name: string;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    snippet: string;
    type: 'review' | 'official' | 'forum' | 'blog' | 'ecommerce';
  }>;
  insights: {
    pros: string[];
    cons: string[];
    price_range: string;
    overall_rating: string;
    key_features: string[];
  };
  api_source: string;
  api_ref: string;
}

const ProductSearch = () => {
  const { query } = useParams<{ query: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState<'cache' | 'api' | null>(null);

  const decodedQuery = query ? decodeURIComponent(query) : '';

  useEffect(() => {
    if (decodedQuery) {
      searchProducts(decodedQuery);
    }
  }, [decodedQuery]);

  const searchProducts = async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 ProductSearch: Starting search for query: "${searchQuery}"`);
      
      const { data, error } = await supabase.functions.invoke('search-products', {
        body: { query: searchQuery, bypassCache: false }
      });
      
      if (error) {
        console.error('❌ ProductSearch: Search error:', error);
        throw error;
      }
      
      console.log('📦 ProductSearch: Raw API response:', data);
      
      if (data && Array.isArray(data.results)) {
        setResults(data.results);
        setSearchSource(data.source || 'api');
        
        toast({
          title: data.source === 'cache' ? "Results from cache" : "Fresh search results",
          description: `Found comprehensive analysis for "${searchQuery}"`,
          duration: 3000
        });
      } else {
        setResults([]);
        setSearchSource(data?.source || null);
      }
      
    } catch (err) {
      console.error('❌ ProductSearch: Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch product information');
      setResults([]);
      setSearchSource(null);
      
      toast({
        title: "Search error",
        description: "Failed to fetch product information",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceTypeColor = (type: string) => {
    switch (type) {
      case 'review': return 'bg-blue-100 text-blue-800';
      case 'official': return 'bg-green-100 text-green-800';
      case 'forum': return 'bg-purple-100 text-purple-800';
      case 'ecommerce': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case 'review': return <Star className="w-3 h-3" />;
      case 'ecommerce': return <DollarSign className="w-3 h-3" />;
      default: return <ExternalLink className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
          <div className="container p-3 mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/explore')}
              className="p-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Logo size="sm" />
          </div>
        </div>
      )}
      
      <div className="flex flex-1">
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={cn("flex-1 pt-16 md:pl-64")}>
          <div className="container max-w-6xl mx-auto p-4 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/explore')}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Explore
                </Button>
              )}
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">Product Search Results</h1>
                <p className="text-muted-foreground">
                  Search results for "{decodedQuery}"
                  {searchSource && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {searchSource === 'cache' ? 'Cached' : 'Fresh'}
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing product information...</p>
                <p className="text-sm text-muted-foreground">This may take a moment while we process multiple sources</p>
              </div>
            )}
            
            {error && (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="w-8 h-8 text-destructive mb-4" />
                <p className="text-muted-foreground">{error}</p>
                <Button 
                  onClick={() => searchProducts(decodedQuery)}
                  variant="outline"
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            )}
            
            {!isLoading && !error && results.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No product information found for "{decodedQuery}"</p>
                <Button
                  onClick={() => navigate('/explore')}
                  variant="outline"
                  className="mt-4"
                >
                  Try another search
                </Button>
              </div>
            )}
            
            {!isLoading && !error && results.length > 0 && (
              <div className="space-y-8">
                {results.map((result, index) => (
                  <div key={index} className="space-y-6">
                    {/* Product Overview */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xl">{result.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground leading-relaxed">{result.summary}</p>
                      </CardContent>
                    </Card>
                    
                    {/* Insights Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Pros & Cons */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ThumbsUp className="w-5 h-5 text-green-600" />
                            Pros & Cons
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {result.insights.pros.length > 0 && (
                            <div>
                              <h4 className="font-medium text-green-700 mb-2">Pros</h4>
                              <ul className="space-y-1">
                                {result.insights.pros.map((pro, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <ThumbsUp className="w-3 h-3 text-green-600 mt-1 flex-shrink-0" />
                                    {pro}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {result.insights.cons.length > 0 && (
                            <div>
                              <h4 className="font-medium text-red-700 mb-2">Cons</h4>
                              <ul className="space-y-1">
                                {result.insights.cons.map((con, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <ThumbsDown className="w-3 h-3 text-red-600 mt-1 flex-shrink-0" />
                                    {con}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      
                      {/* Key Info */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Key Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground">Price Range</h4>
                            <p className="text-sm">{result.insights.price_range}</p>
                          </div>
                          <Separator />
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground">Overall Rating</h4>
                            <p className="text-sm">{result.insights.overall_rating}</p>
                          </div>
                          {result.insights.key_features.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <h4 className="font-medium text-sm text-muted-foreground mb-2">Key Features</h4>
                                <div className="flex flex-wrap gap-1">
                                  {result.insights.key_features.map((feature, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {feature}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    
                    {/* Sources */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Sources ({result.sources.length})</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Information gathered from multiple sources including reviews, forums, and official sites
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {result.sources.map((source, sourceIndex) => (
                            <div key={sourceIndex} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className={cn("text-xs", getSourceTypeColor(source.type))}>
                                      <div className="flex items-center gap-1">
                                        {getSourceTypeIcon(source.type)}
                                        {source.type}
                                      </div>
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium text-sm leading-tight mb-2">{source.title}</h4>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{source.snippet}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  asChild
                                  className="flex-shrink-0"
                                >
                                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
                
                <div className="text-center pt-8">
                  <Button 
                    onClick={() => navigate('/explore')}
                    variant="outline"
                  >
                    Search for another product
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default ProductSearch;
