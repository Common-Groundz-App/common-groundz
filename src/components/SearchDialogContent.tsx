
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useSearch } from "@/hooks/useSearch";
import { SearchResult } from "@/utils/searchUtils";
import { UserSearchResult } from "@/components/search/UserSearchResult";
import { ProductSearchResult } from "@/components/search/ProductSearchResult";
import { FoodSearchResult } from "@/components/search/FoodSearchResult";
import { GenericSearchResult } from "@/components/search/GenericSearchResult";
import { Loader2 } from "lucide-react";

interface SearchDialogContentProps {
  setOpen: (open: boolean) => void;
}

export function SearchDialogContent({ setOpen }: SearchDialogContentProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { isLoading, users, products, foods, recommendations, features, hasResults } = useSearch(query);

  useEffect(() => {
    console.log('SearchDialogContent received:', { 
      query, 
      isLoading, 
      usersCount: users.length,
      productsCount: products.length,
      foodsCount: foods.length,
      recommendationsCount: recommendations.length,
      featuresCount: features.length,
      hasResults
    });
  }, [query, isLoading, users, products, foods, recommendations, features, hasResults]);

  const handleSelect = (result: SearchResult) => {
    console.log('Selected result:', result);
    setOpen(false);
    
    // Navigate based on result type
    if (result.type === "user") {
      // For mock users, don't try to treat their ID as a UUID
      if (result.id.startsWith("user")) {
        console.log("Navigating to mock user profile:", result.id);
        navigate(`/profile/${result.id}`);
      } else {
        // For real database users with UUID, navigate normally
        console.log("Navigating to real user profile:", result.id);
        navigate(`/profile/${result.id}`);
      }
    } else if (result.type === "recommendation") {
      console.log("Navigating to recommendation:", result.id);
      navigate(`/recommendations/${result.id}`);
    } else if (result.type === "feature") {
      console.log("Navigating to features section");
      navigate(`/#features`);
    } else if (result.type === "product") {
      console.log("Navigating to product:", result.id);
      navigate(`/products/${result.id}`);
    } else if (result.type === "food") {
      console.log("Navigating to food:", result.id);
      navigate(`/foods/${result.id}`);
    }
  };

  const handleQueryChange = (value: string) => {
    console.log('Search query changed to:', value);
    setQuery(value);
  };

  return (
    <>
      <CommandInput 
        placeholder="Search for people, products, food..." 
        value={query}
        onValueChange={handleQueryChange}
        autoFocus
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm flex items-center justify-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Searching...
          </div>
        ) : (
          <>
            {query.length > 0 && !hasResults && (
              <CommandEmpty>No results found. Try a different search term.</CommandEmpty>
            )}
            
            {users.length > 0 && (
              <CommandGroup heading="People">
                {users.map((user) => (
                  <UserSearchResult key={user.id} user={user} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
            
            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((product) => (
                  <ProductSearchResult key={product.id} product={product} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}

            {foods.length > 0 && (
              <CommandGroup heading="Foods">
                {foods.map((food) => (
                  <FoodSearchResult key={food.id} food={food} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
            
            {recommendations.length > 0 && (
              <CommandGroup heading="Recommendations">
                {recommendations.map((rec) => (
                  <GenericSearchResult key={rec.id} result={rec} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}
            
            {features.length > 0 && (
              <CommandGroup heading="Features">
                {features.map((feature) => (
                  <GenericSearchResult key={feature.id} result={feature} onSelect={handleSelect} />
                ))}
              </CommandGroup>
            )}

            {query.length === 0 && !hasResults && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type to search users, products, and more...
              </div>
            )}
          </>
        )}
      </CommandList>
    </>
  );
}
