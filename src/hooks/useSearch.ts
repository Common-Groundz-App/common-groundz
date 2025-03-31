
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchResult, mockSearchResults, sampleProducts, sampleFoods } from "@/utils/searchUtils";

export function useSearch(query: string) {
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Don't trigger search until we have at least 2 characters
    if (query.length === 1) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      // Show all results when query is empty
      if (query === '') {
        try {
          setIsLoading(true);
          // Get some initial profiles when search is empty
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url')
            .limit(10);
          
          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            // Fall back to mock data
            setAllResults(mockSearchResults);
            return;
          }

          console.log('Initial profiles data:', profilesData);

          // Transform profiles data into SearchResult format
          const profileResults: SearchResult[] = (profilesData || []).map(profile => ({
            id: profile.id,
            type: "user" as const,
            title: profile.username || 'Anonymous User',
            subtitle: profile.bio || 'No bio available',
            imageUrl: profile.avatar_url || '',
            location: 'No location available', // Default since location doesn't exist in DB
            memberSince: 'January 2023', // Default value
            followingCount: 0
          }));

          setAllResults([
            ...profileResults,
            ...mockSearchResults,
            ...sampleProducts,
            ...sampleFoods
          ]);
        } catch (error) {
          console.error('Error fetching initial results:', error);
          setAllResults(mockSearchResults);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        // Search for profiles (real users) - Making sure the .or() is correctly structured
        console.log('Searching with query:', query);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url')
          .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
          .limit(10);
        
        if (profilesError) {
          console.error('Error searching profiles:', profilesError);
        }

        console.log('Search results from DB:', profilesData);

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

        console.log('Combined search results:', combinedResults.length);
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

    // Add debounce for search with a longer timeout
    const timeoutId = setTimeout(() => {
      fetchData();
    }, query.length > 1 ? 300 : 200); // Longer debounce for search queries, shorter for empty state

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
