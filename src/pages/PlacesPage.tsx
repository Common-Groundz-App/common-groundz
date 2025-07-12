import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Entity } from '@/services/recommendation/types';

const PlacesPage = () => {
  const isMobile = useIsMobile();
  
  const { data: places, isLoading, error } = useQuery({
    queryKey: ['places'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', 'place')
        .eq('is_deleted', false)
        .order('name');
      
      if (error) throw error;
      return data as Entity[];
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {!isMobile && <VerticalTubelightNavbar />}
        <div className={`transition-all duration-300 ${!isMobile ? 'ml-[280px]' : ''}`}>
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-48"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        {!isMobile && <VerticalTubelightNavbar />}
        <div className={`transition-all duration-300 ${!isMobile ? 'ml-[280px]' : ''}`}>
          <div className="container mx-auto px-4 py-8">
            <div className="text-center py-12">
              <p className="text-muted-foreground">Failed to load places</p>
            </div>
          </div>
        </div>
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && <VerticalTubelightNavbar />}
      <div className={`transition-all duration-300 ${!isMobile ? 'ml-[280px]' : ''}`}>
        <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Places</h1>
            <p className="text-muted-foreground mt-2">
              Discover amazing places to visit and explore
            </p>
          </div>
          <Button asChild>
            <Link to="/product-search/places">
              <Plus className="w-4 h-4 mr-2" />
              Add Place
            </Link>
          </Button>
        </div>

        {places && places.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {places.map((place) => (
              <Link
                key={place.id}
                to={`/entity/${place.slug || place.id}`}
                className="group block"
              >
                <div className="bg-card rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6">
                  {place.image_url && (
                    <img
                      src={place.image_url}
                      alt={place.name}
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {place.name}
                  </h3>
                  {place.venue && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {place.venue}
                    </p>
                  )}
                  {place.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {place.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <Badge variant="secondary">Place</Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No places found</p>
            <Button asChild>
              <Link to="/product-search/places">
                <Plus className="w-4 h-4 mr-2" />
                Add the first place
              </Link>
            </Button>
          </div>
        )}
        </div>
      </div>
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default PlacesPage;