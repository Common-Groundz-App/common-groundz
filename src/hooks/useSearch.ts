
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchResult, mockSearchResults, sampleProducts, sampleFoods } from "@/utils/searchUtils";

export function useSearch(query: string) {
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (query.length < 2) {
        // Don't search until at least 2 characters are entered
        setAllResults([]);
        return;
      }

      setIsLoading(true);

      try {
        // Search for profiles (real users) - removed location field from query
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
          type: "user" as const,
          title: profile.username || 'Anonymous User',
          subtitle: profile.bio || 'No bio available',
          imageUrl: profile.avatar_url || '',
          location: 'No location available', // Default value since location doesn't exist in DB
          memberSince: 'January 2023', // Default value
          followingCount: 0
        }));

        console.log("Profile search results:", profileResults);

        // Also search in mock data in case the user is looking for a mock user
        const filteredMockResults = mockSearchResults.filter(
          result =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
        );

        // Filter sample data by query
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

        // Combine all results with profiles first for better visibility
        const combinedResults: SearchResult[] = [
          ...profileResults,
          ...filteredMockResults,
          ...filteredProducts,
          ...filteredFoods
        ];

        setAllResults(combinedResults);
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

  return {
    isLoading,
    users,
    products,
    foods,
    recommendations,
    features,
    hasResults: allResults.length > 0
  };
}
