
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SearchResult, mockSearchResults, sampleProducts, sampleFoods } from "@/utils/searchUtils";

export function useSearch(query: string) {
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('Current query:', query, 'Length:', query.length);
    
    // Don't trigger search until we have at least 2 characters
    if (query.length === 1) {
      console.log('Query too short, skipping search');
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      // Show all results when query is empty
      if (query === '') {
        try {
          console.log('Empty query - fetching initial profiles');
          setIsLoading(true);
          // Get some initial profiles when search is empty
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url')
            .limit(10);
          
          if (profilesError) {
            console.error('Error fetching profiles:', profilesError);
            // Fall back to mock data
            console.log('Falling back to mock data due to error');
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

          console.log('Transformed profile results:', profileResults);
          
          const combinedResults = [
            ...profileResults,
            ...mockSearchResults,
            ...sampleProducts,
            ...sampleFoods
          ];
          
          console.log('Combined initial results count:', combinedResults.length);
          setAllResults(combinedResults);
        } catch (error) {
          console.error('Error fetching initial results:', error);
          setAllResults(mockSearchResults);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      console.log('Starting search for query:', query);
      setIsLoading(true);

      try {
        // Search for profiles with correct .or() syntax - using template string properly
        console.log('Executing Supabase query with:', query);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, bio, avatar_url')
          .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
          .limit(10);
        
        console.log('Supabase query:', `username.ilike.%${query}%,bio.ilike.%${query}%`);
        console.log('Supabase Results:', profilesData);
        
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

        console.log('Transformed DB profile results:', profileResults.length);

        // Also search in mock data in case the user is looking for a mock user
        const filteredMockResults = mockSearchResults.filter(
          result =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
        );

        console.log('Filtered mock results count:', filteredMockResults.length);

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

        console.log('Filtered products count:', filteredProducts.length);
        console.log('Filtered foods count:', filteredFoods.length);

        // Combine all results with profiles first for better visibility
        const combinedResults: SearchResult[] = [
          ...profileResults,
          ...filteredMockResults,
          ...filteredProducts,
          ...filteredFoods
        ];

        console.log('Combined search results count:', combinedResults.length);
        console.log('Combined search results:', combinedResults);
        
        setAllResults(combinedResults);
      } catch (error) {
        console.error('Search error:', error);
        // Fall back to mock data on error
        const filteredMockResults = mockSearchResults.filter(
          result =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            (result.subtitle && result.subtitle.toLowerCase().includes(query.toLowerCase()))
        );
        console.log('Error occurred, falling back to filtered mock results:', filteredMockResults.length);
        setAllResults(filteredMockResults);
      } finally {
        console.log('Search completed, setting isLoading to false');
        setIsLoading(false);
      }
    };

    // Add debounce for search with a longer timeout
    console.log('Setting up debounced search with timeout:', query.length > 1 ? 300 : 200, 'ms');
    const timeoutId = setTimeout(() => {
      console.log('Debounce timeout finished, executing fetchData()');
      fetchData();
    }, query.length > 1 ? 300 : 200); // Longer debounce for search queries, shorter for empty state

    return () => {
      console.log('Clearing previous timeout');
      clearTimeout(timeoutId);
    };
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
