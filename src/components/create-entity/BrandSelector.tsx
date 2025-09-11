import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EntityType } from '@/services/recommendation/types';
import { getEntitiesByType } from '@/services/recommendation/entityOperations';
import { Search, Plus, Building2, CheckCircle, X } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface BrandSelectorProps {
  entityType: EntityType;
  selectedBrandId: string;
  selectedBrandName: string;
  onBrandSelect: (brandId: string, brandName: string) => void;
}

interface BrandEntity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
}

export function BrandSelector({
  entityType,
  selectedBrandId,
  selectedBrandName,
  onBrandSelect
}: BrandSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState<BrandEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadBrands();
  }, [debouncedSearch]);

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      const results = await getEntitiesByType(EntityType.Brand, debouncedSearch);
      setBrands(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Failed to load brands:', error);
      setBrands([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandSelect = (brand: BrandEntity) => {
    onBrandSelect(brand.id, brand.name);
  };

  const handleCreateBrand = async () => {
    if (newBrandName.trim()) {
      setIsLoading(true);
      try {
        const { createBrand } = await import('@/services/brandService');
        const { supabase } = await import('@/integrations/supabase/client');
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        
        const newBrand = await createBrand(
          { 
            name: newBrandName.trim(),
            description: `${newBrandName.trim()} brand`
          },
          user?.id
        );
        
        if (newBrand) {
          onBrandSelect(newBrand.id, newBrand.name);
          setNewBrandName('');
          setShowCreateDialog(false);
        } else {
          console.error('Failed to create brand');
        }
      } catch (error) {
        console.error('Error creating brand:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSkip = () => {
    onBrandSelect('', '');
  };

  const handleClear = () => {
    onBrandSelect('', '');
  };

  const getEntityTypeLabel = (type: EntityType) => {
    switch (type) {
      case EntityType.Product: return 'products';
      case EntityType.Place: return 'locations';
      case EntityType.Book: return 'books';
      case EntityType.Movie: return 'movies';
      case EntityType.TvShow: return 'TV shows';
      case EntityType.Course: return 'courses';
      case EntityType.App: return 'apps';
      case EntityType.Game: return 'games';
      case EntityType.Experience: return 'experiences';
      default: return 'items';
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Select a Brand or Organization
        </h2>
        <p className="text-muted-foreground">
          Is this {entityType.toLowerCase()} from a specific brand, company, or organization? This helps organize {getEntityTypeLabel(entityType)} better.
        </p>
      </div>

      {/* Selected Brand Display */}
      {selectedBrandId && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{selectedBrandName}</p>
                  <p className="text-sm text-muted-foreground">Selected brand</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Create Section */}
      {!selectedBrandId && (
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for brands, companies, or organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Create New Brand Button */}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Create New Brand
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Brand</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Brand name..."
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateBrand()}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBrand}
                    disabled={!newBrandName.trim() || isLoading}
                  >
                    Create Brand
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Search Results */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Searching brands...</p>
            </div>
          ) : brands.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Search Results</p>
              {brands.map((brand) => (
                <Card
                  key={brand.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleBrandSelect(brand)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        {brand.image_url ? (
                          <img
                            src={brand.image_url}
                            alt={brand.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{brand.name}</p>
                        {brand.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {brand.description}
                          </p>
                        )}
                      </div>
                      <CheckCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No brands found for "{searchQuery}"
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setShowCreateDialog(true)}
              >
                Create "{searchQuery}" as new brand
              </Button>
            </div>
          ) : null}

          {/* Skip Option */}
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              Skip - No specific brand
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              You can add brand information later
            </p>
          </div>
        </div>
      )}
    </div>
  );
}