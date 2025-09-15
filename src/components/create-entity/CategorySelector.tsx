import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EntityType } from '@/services/recommendation/types';
import { getCategoryHierarchy, searchCategories } from '@/services/categoryService';
import { Category, CategoryHierarchy } from '@/types/categories';
import { Search, ChevronRight, CheckCircle, Folder, FolderOpen } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface CategorySelectorProps {
  entityType: EntityType;
  selectedCategoryId: string;
  onCategorySelect: (categoryId: string) => void;
}

export function CategorySelector({
  entityType,
  selectedCategoryId,
  onCategorySelect
}: CategorySelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<CategoryHierarchy[]>([]);
  const [searchResults, setSearchResults] = useState<Category[]>([]);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      handleSearch();
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearch]);

  const loadCategories = async () => {
    try {
      const hierarchy = await getCategoryHierarchy();
      setCategories(hierarchy);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const results = await searchCategories(debouncedSearch);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search categories:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const getSelectedCategoryName = () => {
    if (!selectedCategoryId) return null;
    
    // Look in main categories
    for (const category of categories) {
      if (category.id === selectedCategoryId) {
        return category.name;
      }
      // Look in subcategories
      for (const sub of category.subcategories) {
        if (sub.id === selectedCategoryId) {
          return `${category.name} > ${sub.name}`;
        }
      }
    }
    
    // Look in search results
    const searchResult = searchResults.find(c => c.id === selectedCategoryId);
    return searchResult?.name || null;
  };

  const getEntityTypeRecommendedCategories = (type: EntityType): string[] => {
    switch (type) {
      case EntityType.Product:
        return ['Electronics', 'Fashion', 'Home & Garden', 'Beauty'];
      case EntityType.Place:
        return ['Restaurants', 'Hotels', 'Entertainment', 'Shopping'];
      case EntityType.Book:
        return ['Fiction', 'Non-Fiction', 'Educational', 'Reference'];
      case EntityType.Movie:
        return ['Action', 'Comedy', 'Drama', 'Documentary'];
      case EntityType.TvShow:
        return ['Drama', 'Comedy', 'Documentary', 'Reality'];
      case EntityType.Course:
        return ['Technology', 'Business', 'Creative', 'Academic'];
      case EntityType.App:
        return ['Productivity', 'Entertainment', 'Social', 'Utilities'];
      case EntityType.Game:
        return ['Action', 'Strategy', 'Puzzle', 'Sports'];
      case EntityType.Experience:
        return ['Travel', 'Entertainment', 'Education', 'Adventure'];
      case EntityType.Brand:
        return ['Technology', 'Fashion', 'Food & Beverage', 'Services'];
      default:
        return [];
    }
  };

  const recommendedCategories = getEntityTypeRecommendedCategories(entityType);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Choose a Category
        </h2>
        <p className="text-muted-foreground">
          Select the most appropriate category for your {entityType.toLowerCase()}
        </p>
      </div>

      {/* Selected Category Display */}
      {selectedCategoryId && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Selected Category</p>
                <p className="text-sm text-muted-foreground">
                  {getSelectedCategoryName()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      {searchQuery && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Search Results</p>
          {isSearching ? (
            <div className="text-center py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-1">
              {searchResults.map((category) => (
                <Card
                  key={category.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedCategoryId === category.id
                      ? 'ring-2 ring-primary border-primary bg-primary/5'
                      : 'hover:bg-accent/50'
                  }`}
                  onClick={() => onCategorySelect(category.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Folder className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {category.name}
                        </span>
                        {category.description && (
                          <span className="text-sm text-muted-foreground">
                            - {category.description}
                          </span>
                        )}
                      </div>
                      {selectedCategoryId === category.id && (
                        <CheckCircle className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No categories found for "{searchQuery}"
            </p>
          )}
        </div>
      )}

      {/* Category Hierarchy (when not searching) */}
      {!searchQuery && (
        <div className="space-y-4">
          {/* Recommended Categories */}
          {recommendedCategories.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Recommended for {entityType.toLowerCase()}s
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendedCategories.map((catName) => {
                  const category = categories.find(c => 
                    c.name.toLowerCase().includes(catName.toLowerCase()) ||
                    c.subcategories.some(sub => sub.name.toLowerCase().includes(catName.toLowerCase()))
                  );
                  if (!category) return null;
                  
                  return (
                    <Badge
                      key={catName}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                      onClick={() => onCategorySelect(category.id)}
                    >
                      {catName}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Categories */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">All Categories</p>
            <div className="space-y-1">
              {categories.map((category) => (
                <div key={category.id}>
                  {/* Main Category */}
                  <Card
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedCategoryId === category.id
                        ? 'ring-2 ring-primary border-primary bg-primary/5'
                        : selectedMainCategory === category.id
                        ? 'bg-accent/50'
                        : 'hover:bg-accent/30'
                    }`}
                    onClick={() => {
                      if (selectedMainCategory === category.id) {
                        setSelectedMainCategory(null);
                      } else {
                        setSelectedMainCategory(category.id);
                      }
                      onCategorySelect(category.id);
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {selectedMainCategory === category.id ? (
                            <FolderOpen className="w-4 h-4 text-primary" />
                          ) : (
                            <Folder className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="font-medium text-foreground">
                            {category.name}
                          </span>
                          {category.subcategories.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {category.subcategories.length}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedCategoryId === category.id && (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          )}
                          {category.subcategories.length > 0 && (
                            <ChevronRight
                              className={`w-4 h-4 text-muted-foreground transition-transform ${
                                selectedMainCategory === category.id ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Subcategories */}
                  {selectedMainCategory === category.id && category.subcategories.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {category.subcategories.map((subCategory) => (
                        <Card
                          key={subCategory.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            selectedCategoryId === subCategory.id
                              ? 'ring-2 ring-primary border-primary bg-primary/5'
                              : 'hover:bg-accent/50'
                          }`}
                          onClick={() => onCategorySelect(subCategory.id)}
                        >
                          <CardContent className="p-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-foreground">
                                {subCategory.name}
                              </span>
                              {selectedCategoryId === subCategory.id && (
                                <CheckCircle className="w-3 h-3 text-primary" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}