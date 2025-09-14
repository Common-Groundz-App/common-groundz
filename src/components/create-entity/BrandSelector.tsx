import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { checkBrandExists, createBrand, CreateBrandData } from '@/services/brandService';
import { Entity, EntityType } from '@/services/recommendation/types';
import { useBrandSearch } from '@/hooks/useBrandSearch';
import { Building, Plus, X, Search, Upload, Loader2 } from 'lucide-react';

interface BrandSelectorProps {
  entityType: EntityType;
  selectedBrand?: {
    id: string;
    name: string;
    image_url?: string;
  } | null;
  onBrandSelect: (brandId: string, brandName: string, brandImageUrl: string) => void;
  onSkip?: () => void;
}

interface BrandEntity {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  approval_status?: string;
}

export const BrandSelector: React.FC<BrandSelectorProps> = ({
  entityType,
  selectedBrand,
  onBrandSelect,
  onSkip
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandState, setSelectedBrandState] = useState<BrandEntity | null>(selectedBrand || null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDropdownClosing, setIsDropdownClosing] = useState(false);

  // Brand search hook
  const { brands, isLoading, error } = useBrandSearch(searchQuery);

  // Brand creation states
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandDescription, setNewBrandDescription] = useState('');
  const [newBrandImageUrl, setNewBrandImageUrl] = useState('');
  const [newBrandImageFile, setNewBrandImageFile] = useState<File | null>(null);
  const [newBrandWebsite, setNewBrandWebsite] = useState('');
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  // Other states
  const [duplicateWarning, setDuplicateWarning] = useState<BrandEntity | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // Handle brand selection from search results
  const handleResultClick = (brand: BrandEntity) => {
    // Start dropdown closing animation
    setIsDropdownClosing(true);
    
    // Select the brand and clear search
    setSelectedBrandState(brand);
    onBrandSelect(brand.id, brand.name, brand.image_url || '');
    
    // Clear search and close dropdown after animation
    setTimeout(() => {
      setSearchQuery('');
      setIsDropdownClosing(false);
    }, 300);
  };

  // Sync selectedBrand prop with local state and set search query on mount
  useEffect(() => {
    setSelectedBrandState(selectedBrand || null);
    // If a brand is selected when component mounts, show it in search
    if (selectedBrand) {
      setSearchQuery(selectedBrand.name);
    } else {
      // Clear search query when no brand is selected
      setSearchQuery('');
    }
  }, [selectedBrand]);

  const handleSkipClick = () => {
    setSelectedBrandState(null);
    setSearchQuery('');
    if (onSkip) {
      onSkip();
    }
  };

  const clearSelectedBrand = () => {
    setSelectedBrandState(null);
    setSearchQuery('');
    // Clear the selection by calling onBrandSelect with null values to properly reset form
    onBrandSelect(null as any, null as any, null as any);
  };

  const checkForDuplicates = useCallback(async (name: string) => {
    if (!name.trim()) {
      setDuplicateWarning(null);
      return;
    }
    
    try {
      const existingBrand = await checkBrandExists(name.trim());
      setDuplicateWarning(existingBrand as BrandEntity | null);
    } catch (error) {
      console.error('Error checking for duplicates:', error);
    }
  }, []);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewBrandImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setNewBrandImageUrl('');
    }
  };

  const handleImageUrlChange = (url: string) => {
    setNewBrandImageUrl(url);
    setImagePreview(url);
    setNewBrandImageFile(null);
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;
    
    setIsCreatingBrand(true);
    try {
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
        setSelectedBrandState(newBrand as BrandEntity);
        onBrandSelect(newBrand.id, newBrand.name, newBrand.image_url || '');
        
        // Reset form
        setNewBrandName('');
        setNewBrandDescription('');
        setNewBrandImageUrl('');
        setNewBrandImageFile(null);
        setNewBrandWebsite('');
        setImagePreview('');
        setDuplicateWarning(null);
        setIsCreateDialogOpen(false);
        
        toast({
          title: "Brand created successfully",
          description: `${newBrand.name} has been added and selected.`
        });
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
      setIsCreatingBrand(false);
    }
  };

  const getEntityTypeLabel = (type: EntityType): string => {
    switch (type) {
      case EntityType.Product:
        return 'product';
      case EntityType.Place:
        return 'place';
      case EntityType.Book:
        return 'book';
      case EntityType.Movie:
        return 'movie';
      case 'food' as any:
        return 'food item';
      default:
        return 'item';
    }
  };

  // Show dropdown when user has typed at least 1 character and not closing
  const shouldShowDropdown = searchQuery && searchQuery.trim().length >= 1 && !isDropdownClosing;

  return (
    <div className="space-y-4">
      {/* Search Interface */}
      <div className="relative overflow-visible">
        <div className="flex items-center border rounded-lg overflow-hidden bg-background">
          <div className="pl-3 text-muted-foreground">
            <Search size={18} />
          </div>
          <Input
            type="text"
            placeholder={`Search for a brand for your ${getEntityTypeLabel(entityType)}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        
        {/* Search Results Dropdown */}
        {shouldShowDropdown && (
          <div className={`absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-xl z-[60] max-h-[70vh] overflow-y-auto transition-all duration-300 ${
            isDropdownClosing ? 'opacity-0 transform scale-95 translate-y-2' : 'opacity-100 transform scale-100 translate-y-0'
          }`}>
            
            {/* Loading State */}
            {isLoading && (
              <div className="p-3 text-center border-b bg-background">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Searching brands...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-3 text-center border-b bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex items-center justify-center gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <span>{error}</span>
                </div>
              </div>
            )}
            
            {/* Available Brands */}
            {brands.length > 0 && (
              <div className="border-b last:border-b-0 bg-background">
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
                  ✨ Already on Groundz ({brands.length})
                </div>
                {brands.map((brand) => {
                  const isSelected = selectedBrandState?.id === brand.id;
                  return (
                    <div
                      key={brand.id}
                      onClick={() => handleResultClick(brand)}
                      className={`flex items-center px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        isSelected ? 'bg-primary/10 border-l-4 border-primary' : ''
                      }`}
                    >
                      {brand.image_url && (
                        <img
                          src={brand.image_url}
                          alt={brand.name}
                          className="w-10 h-10 rounded-lg object-cover mr-3 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {brand.name}
                          {isSelected && (
                            <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              Selected
                            </span>
                          )}
                        </div>
                        {brand.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                            {brand.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* No Results */}
            {!isLoading && searchQuery && brands.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No brands found for "{searchQuery}"</p>
                <p className="text-xs mt-1">Create a new brand below</p>
              </div>
            )}

            {/* Create New Brand Button */}
            <div className="p-2 border-t bg-background">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      // Close dropdown when create new brand is clicked
                      setIsDropdownClosing(true);
                      setTimeout(() => {
                        setSearchQuery('');
                        setIsDropdownClosing(false);
                      }, 300);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Brand
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Area - Selected Brand Display & Actions */}
      <Card>
        <CardContent className="p-4">
          {selectedBrandState ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {selectedBrandState.image_url && (
                  <img
                    src={selectedBrandState.image_url}
                    alt={selectedBrandState.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="font-medium">{selectedBrandState.name}</h3>
                  {selectedBrandState.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {selectedBrandState.description}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelectedBrand}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <Building className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No brand selected for your {getEntityTypeLabel(entityType)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Search above to find or create a brand
              </p>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="mt-4 pt-4 border-t">
            {selectedBrandState ? (
              /* When brand is selected, only show Remove Brand button */
              <Button
                variant="outline"
                onClick={clearSelectedBrand}
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Remove Brand
              </Button>
            ) : (
              /* When no brand selected, show Skip and Create buttons */
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleSkipClick}
                  className="flex-1"
                >
                  Skip Brand Selection
                </Button>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default" className="flex-1">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Brand
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Brand Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
                <p className="text-sm text-yellow-600 mt-1">
                  A brand named "{duplicateWarning.name}" already exists.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="brand-description">Description</Label>
              <Textarea
                id="brand-description"
                placeholder="Brief description (optional)"
                value={newBrandDescription}
                onChange={(e) => setNewBrandDescription(e.target.value)}
                rows={3}
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
                  setIsCreateDialogOpen(false);
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
                disabled={!newBrandName.trim() || isCreatingBrand}
              >
                {isCreatingBrand ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Brand'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
