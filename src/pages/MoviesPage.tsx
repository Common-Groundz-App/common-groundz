import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Entity } from '@/services/recommendation/types';

const MoviesPage = () => {
  const isMobile = useIsMobile();
  
  const { data: movies, isLoading, error } = useQuery({
    queryKey: ['movies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entities')
        .select('*')
        .eq('type', 'movie')
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
              <p className="text-muted-foreground">Failed to load movies</p>
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
              <h1 className="text-3xl font-bold">Movies</h1>
              <p className="text-muted-foreground mt-2">
                Explore movies and share your cinematic discoveries
              </p>
            </div>
            <Button asChild>
              <Link to="/product-search/movies">
                <Plus className="w-4 h-4 mr-2" />
                Add Movie
              </Link>
            </Button>
          </div>

          {movies && movies.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {movies.map((movie) => (
                <Link
                  key={movie.id}
                  to={`/entity/${movie.slug || movie.id}`}
                  className="group block"
                >
                  <div className="bg-card rounded-lg shadow-sm border hover:shadow-md transition-shadow p-6">
                    {movie.image_url && (
                      <img
                        src={movie.image_url}
                        alt={movie.name}
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {movie.name}
                    </h3>
                    {movie.publication_year && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {movie.publication_year}
                      </p>
                    )}
                    {movie.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {movie.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <Badge variant="secondary">Movie</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No movies found</p>
              <Button asChild>
                <Link to="/product-search/movies">
                  <Plus className="w-4 h-4 mr-2" />
                  Add the first movie
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

export default MoviesPage;