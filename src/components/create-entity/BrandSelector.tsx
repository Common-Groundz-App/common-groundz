import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EntityType } from '@/services/recommendation/types';
import { getEntitiesByType } from '@/services/recommendation/entityOperations';
import { Search, Plus, Building2, CheckCircle, X, Upload, AlertTriangle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';

interface BrandSelectorProps {
  entityType: EntityType;
  selectedBrandId: string;
  selectedBrandName: string;
  selectedBrandImageUrl: string;
  onBrandSelect: (brandId: string, brandName: string, brandImageUrl: string) => void;
  onSkip?: () => void; // Add optional skip callback
}

interface BrandEntity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  approval_status?: string;
  created_by?: string;
}

export function BrandSelector({
  entityType,
  selectedBrandId,
  selectedBrandName,
  selectedBrandImageUrl,
  onBrandSelect,
  onSkip
}: BrandSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [brands, setBrands] = useState<BrandEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Add local state for immediate visual feedback
  const [localSelectedBrandId, setLocalSelectedBrandId] = useState(selectedBrandId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDescription, setNewBrandDescription] = useState('');
  const [newBrandImageUrl, setNewBrandImageUrl] = useState('');
  const [newBrandImageFile, setNewBrandImageFile] = useState<File | null>(null);
  const [newBrandWebsite, setNewBrandWebsite] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<BrandEntity | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { toast } = useToast();

  useEffect(() => {
    loadBrands();
  }, [debouncedSearch]);

  // Sync local state with props
  useEffect(() => {
    setLocalSelectedBrandId(selectedBrandId);
  }, [selectedBrandId]);

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      // Get current user for filtering
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { user } } = await supabase.auth.getUser();
      
      const results = await getEntitiesByType(EntityType.Brand, debouncedSearch, user?.id);
      setBrands(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Failed to load brands:', error);
      setBrands([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandSelect = (brand: BrandEntity) => {
    console.log('Brand selected:', brand);
    // Update local state immediately for instant visual feedback
    setLocalSelectedBrandId(brand.id);
    onBrandSelect(brand.id, brand.name, brand.image_url || '');
  };

  const handleSkipClick = () => {
    console.log('Skip clicked - clearing brand selection');
    // Update local state immediately 
    setLocalSelectedBrandId('');
    onBrandSelect('', '', '');
    onSkip?.(); // Call the skip callback if provided
  };

  const checkForDuplicates = async (name: string) => {
    if (!name.trim()) {
      setDuplicateWarning(null);
      return;
    }
    
    try {
      const { checkBrandExists } = await import('@/services/brandService');
      const existingBrand = await checkBrandExists(name.trim());
      setDuplicateWarning(existingBrand);
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewBrandImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setNewBrandImageUrl(''); // Clear URL input when file is selected
    }
  };

  const handleImageUrlChange = (url: string) => {
    setNewBrandImageUrl(url);
    setImagePreview(url);
    setNewBrandImageFile(null); // Clear file when URL is entered
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;
    
    setIsLoading(true);
    try {
      const { createBrand } = await import('@/services/brandService');
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      const newBrand = await createBrand(
        { 
          name: newBrandName.trim(),
          description: newBrandDescription.trim() || `${newBrandName.trim()} brand`,
          image_url: newBrandImageUrl || undefined,
          image_file: newBrandImageFile || undefined,
          website_url: newBrandWebsite.trim() || undefined
        },
        user?.id
      );
      
      if (newBrand) {
        setLocalSelectedBrandId(newBrand.id);
        onBrandSelect(newBrand.id, newBrand.name, newBrand.image_url || '');
        // Reset form
        setNewBrandName('');
        setNewBrandDescription('');
        setNewBrandImageUrl('');
        setNewBrandImageFile(null);
        setNewBrandWebsite('');
        setImagePreview('');
        setDuplicateWarning(null);
        setShowCreateDialog(false);
        
        toast({
          title: "Brand created successfully",
          description: `${newBrand.name} has been added and selected.`
        });
        
        // Refresh the brands list to show the new brand
        loadBrands();
      } else {
        toast({
          title: "Failed to create brand",
          description: "Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating brand:', error);
      toast({
        title: "Error creating brand",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    onBrandSelect('', '', '');
  };

  const handleClear = () => {
    setLocalSelectedBrandId('');
    onBrandSelect('', '', '');
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
      {localSelectedBrandId && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedBrandImageUrl ? (
                    <img
                      src={selectedBrandImageUrl}
                      alt={selectedBrandName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
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
      {!localSelectedBrandId && (
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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Brand</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="brand-name">Brand Name *</Label>
                  <Input
                    id="brand-name"
                    placeholder="Enter brand name..."
                    value={newBrandName}
                    onChange={(e) => {
                      setNewBrandName(e.target.value);
                      checkForDuplicates(e.target.value);
                    }}
                  />
                  {duplicateWarning && (
                    <Alert className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        A brand named "{duplicateWarning.name}" already exists. You can still create this brand if it's different.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div>
                  <Label htmlFor="brand-description">Description</Label>
                  <Input
                    id="brand-description"
                    placeholder="Brief description (optional)"
                    value={newBrandDescription}
                    onChange={(e) => setNewBrandDescription(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Brand Logo</Label>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="logo-file" className="text-sm text-muted-foreground">Upload Image</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="logo-file"
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-medium"
                        />
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    
                    <div className="relative">
                      <Label className="text-sm text-muted-foreground">Or paste image URL</Label>
                      <Input
                        placeholder="https://example.com/logo.png"
                        value={newBrandImageUrl}
                        onChange={(e) => handleImageUrlChange(e.target.value)}
                      />
                    </div>

                    {imagePreview && (
                      <div className="flex justify-center">
                        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={() => setImagePreview('')}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="brand-website">Website</Label>
                  <Input
                    id="brand-website"
                    placeholder="https://example.com (optional)"
                    value={newBrandWebsite}
                    onChange={(e) => setNewBrandWebsite(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateDialog(false);
                      setNewBrandName('');
                      setNewBrandDescription('');
                      setNewBrandImageUrl('');
                      setNewBrandImageFile(null);
                      setNewBrandWebsite('');
                      setImagePreview('');
                      setDuplicateWarning(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateBrand}
                    disabled={!newBrandName.trim() || isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create Brand'}
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
              {brands.map((brand) => {
                const isSelected = localSelectedBrandId === brand.id;
                return (
                  <Card
                    key={brand.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'ring-2 ring-primary border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Card clicked for brand:', brand.name, brand.id);
                      handleBrandSelect(brand);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-background'
                        }`}>
                          {brand.image_url ? (
                            <img
                              src={brand.image_url}
                              alt={brand.name}
                              className="w-5 h-5 object-cover rounded"
                              onError={(e) => {
                                console.log('Image failed to load:', brand.image_url);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Building2 className="w-5 h-5" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground truncate">
                              {brand.name}
                            </h3>
                            {isSelected && (
                              <Badge variant="default" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                          {brand.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {brand.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
              variant="outline"
              onClick={handleSkipClick}
              className="w-full border-primary/30 text-primary hover:bg-primary/5 hover:border-primary transition-all duration-200"
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