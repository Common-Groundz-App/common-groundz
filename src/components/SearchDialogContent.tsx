
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { User, Hash, Star, Coffee, Pizza } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

// Export type for search results so it can be used elsewhere
export type SearchResult = {
  id: string;
  type: "user" | "recommendation" | "feature" | "product" | "food";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  location?: string;
  memberSince?: string;
  followingCount?: number;
};

// Mock data - in a real app, this would come from an API
export const mockSearchResults: SearchResult[] = [
  {
    id: "user1",
    type: "user",
    title: "Hana Li",
    subtitle: "Food Enthusiast",
    imageUrl: "https://uyjtgybbktgapspodajy.supabase.co/storage/v1/object/public/profile_images/abfcbf43-b985-40dc-933c-201e5448b794/avatar.png",
    location: "New York, NY",
    memberSince: "January 2021",
    followingCount: 120
  },
  {
    id: "user2",
    type: "user",
    title: "Sam Johnson",
    subtitle: "Photographer",
    location: "Brooklyn, NY",
    memberSince: "March 2022",
    followingCount: 85
  },
  {
    id: "rec1",
    type: "recommendation",
    title: "Coffee Shops in Brooklyn",
    subtitle: "15 places to visit",
  },
  {
    id: "feat1",
    type: "feature",
    title: "Community Events",
    subtitle: "Find events in your area",
  },
];

// Sample data for products and foods
const sampleProducts = [
  {
    id: "prod1",
    type: "product",
    title: "Smart Watch",
    subtitle: "Fitness tracker with heart rate monitor",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "prod2",
    type: "product",
    title: "Wireless Headphones",
    subtitle: "Noise-cancelling with 20hr battery life",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80"
  }
];

const sampleFoods = [
  {
    id: "food1",
    type: "food",
    title: "Margherita Pizza",
    subtitle: "Classic Italian pizza with tomato and mozzarella",
    imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80"
  },
  {
    id: "food2",
    type: "food",
    title: "Cappuccino",
    subtitle: "Espresso with steamed milk and foam",
    imageUrl: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=300&q=80"
  }
];

interface SearchDialogContentProps {
  setOpen: (open: boolean) => void;
}

export function SearchDialogContent({ setOpen }: SearchDialogContentProps) {
  const [query, setQuery] = useState("");
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      if (query.length < 2) {
        // Don't search until at least 2 characters are entered
        setAllResults([]);
        return;
      }

      setIsLoading(true);

      try {
        // Search for profiles (real users)
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url')
          .or(`username.ilike.%${query}%, bio.ilike.%${query}%`)
          .limit(5);
        
        if (profilesError) {
          console.error('Error searching profiles:', profilesError);
        }

        // Transform profiles data into SearchResult format
        const profileResults: SearchResult[] = (profilesData || []).map(profile => ({
          id: profile.id,
          type: 'user',
          title: profile.username || 'Anonymous User',
          subtitle: profile.bio || 'No bio available',
          imageUrl: profile.avatar_url || '',
        }));

        // Combine with sample data (filtered by query)
        const filteredProducts = sampleProducts.filter(
          product => 
            product.title.toLowerCase().includes(query.toLowerCase()) || 
            (product.subtitle && product.subtitle.toLowerCase().includes(query.toLowerCase()))
        );
        
        const filteredFoods = sampleFoods.filter(
          food => 
            food.title.toLowerCase().includes(query.toLowerCase()) || 
            (food.subtitle && food.subtitle.toLowerCase().includes(query.toLowerCase()))
        );

        // Combine all results
        const combinedResults = [
          ...profileResults,
          ...filteredProducts,
          ...filteredFoods
        ];

        // If no database results, use mock data as fallback
        if (combinedResults.length === 0) {
          const filteredMockResults = mockSearchResults.filter(
            result =>
              result.title.toLowerCase().includes(query.toLowerCase()) ||
              (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
          );
          setAllResults(filteredMockResults);
        } else {
          setAllResults(combinedResults);
        }
      } catch (error) {
        console.error('Search error:', error);
        // Fall back to mock data on error
        const filteredMockResults = mockSearchResults.filter(
          result =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
        );
        setAllResults(filteredMockResults);
      } finally {
        setIsLoading(false);
      }
    };

    // Add debounce for search
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Group results by type
  const users = allResults.filter((r) => r.type === "user");
  const products = allResults.filter((r) => r.type === "product");
  const foods = allResults.filter((r) => r.type === "food");
  const recommendations = allResults.filter((r) => r.type === "recommendation");
  const features = allResults.filter((r) => r.type === "feature");

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    
    // Navigate based on result type
    if (result.type === "user") {
      // For mock users, don't try to treat their ID as a UUID
      if (result.id.startsWith("user")) {
        console.log("Navigating to mock user profile:", result.id);
        navigate(`/profile/${result.id}`);
      } else {
        // For real database users with UUID, navigate normally
        navigate(`/profile/${result.id}`);
      }
    } else if (result.type === "recommendation") {
      navigate(`/recommendations/${result.id}`);
    } else if (result.type === "feature") {
      navigate(`/#features`);
    } else if (result.type === "product") {
      navigate(`/products/${result.id}`);
    } else if (result.type === "food") {
      navigate(`/foods/${result.id}`);
    }
  };

  // Function to get the appropriate icon for a result type
  const getIconForType = (type: string) => {
    switch (type) {
      case "product":
        return <Star className="mr-2 h-4 w-4" />;
      case "food":
        type === "Margherita Pizza" ? <Pizza className="mr-2 h-4 w-4" /> : <Coffee className="mr-2 h-4 w-4" />;
      default:
        return <Hash className="mr-2 h-4 w-4" />;
    }
  };

  return (
    <>
      <CommandInput 
        placeholder="Search for people, products, food..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading ? (
          <div className="py-6 text-center text-sm">Searching...</div>
        ) : (
          <>
            <CommandEmpty>No results found. Try a different search term.</CommandEmpty>
            
            {users.length > 0 && (
              <CommandGroup heading="People">
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => handleSelect(user)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.imageUrl} alt={user.title} />
                        <AvatarFallback>
                          {user.title.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span>{user.title}</span>
                        {user.subtitle && (
                          <span className="text-xs text-muted-foreground">{user.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {products.length > 0 && (
              <CommandGroup heading="Products">
                {products.map((product) => (
                  <CommandItem
                    key={product.id}
                    onSelect={() => handleSelect(product)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {product.imageUrl ? (
                        <img 
                          src={product.imageUrl} 
                          alt={product.title} 
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <Star className="mr-2 h-4 w-4" />
                      )}
                      <div className="flex flex-col">
                        <span>{product.title}</span>
                        {product.subtitle && (
                          <span className="text-xs text-muted-foreground">{product.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {foods.length > 0 && (
              <CommandGroup heading="Foods">
                {foods.map((food) => (
                  <CommandItem
                    key={food.id}
                    onSelect={() => handleSelect(food)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {food.imageUrl ? (
                        <img 
                          src={food.imageUrl} 
                          alt={food.title} 
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        food.title.includes("Pizza") ? 
                          <Pizza className="mr-2 h-4 w-4" /> : 
                          <Coffee className="mr-2 h-4 w-4" />
                      )}
                      <div className="flex flex-col">
                        <span>{food.title}</span>
                        {food.subtitle && (
                          <span className="text-xs text-muted-foreground">{food.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {recommendations.length > 0 && (
              <CommandGroup heading="Recommendations">
                {recommendations.map((rec) => (
                  <CommandItem
                    key={rec.id}
                    onSelect={() => handleSelect(rec)}
                    className="cursor-pointer"
                  >
                    <Hash className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{rec.title}</span>
                      {rec.subtitle && (
                        <span className="text-xs text-muted-foreground">{rec.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            
            {features.length > 0 && (
              <CommandGroup heading="Features">
                {features.map((feature) => (
                  <CommandItem
                    key={feature.id}
                    onSelect={() => handleSelect(feature)}
                    className="cursor-pointer"
                  >
                    <Star className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>{feature.title}</span>
                      {feature.subtitle && (
                        <span className="text-xs text-muted-foreground">{feature.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </>
  );
}
