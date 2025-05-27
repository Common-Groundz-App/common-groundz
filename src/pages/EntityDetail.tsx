
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { EntityDetailSkeleton } from '@/components/loading/EntityDetailSkeleton';
import { trackEntityView } from '@/services/enhancedEntityService';
import { ensureEntityImagesBucket } from '@/services/imageStorageService';
import { EnhancedEntityDisplay } from '@/components/entity/EnhancedEntityDisplay';
import { useToast } from '@/hooks/use-toast';

const EntityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [entity, setEntity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure storage bucket exists
    ensureEntityImagesBucket().catch(console.error);
  }, []);

  useEffect(() => {
    if (!slug) {
      setError('Entity not found');
      setIsLoading(false);
      return;
    }

    fetchEntity();
  }, [slug, user?.id]);

  const fetchEntity = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Fetching entity:', slug);
      
      // Try to find entity by slug first, then by ID
      let query = supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false);
      
      // Check if slug is a UUID (ID) or actual slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
      
      if (isUUID) {
        query = query.eq('id', slug);
      } else {
        query = query.eq('slug', slug);
      }
      
      const { data, error: fetchError } = await query.single();

      if (fetchError) {
        console.error('❌ Entity fetch error:', fetchError);
        if (fetchError.code === 'PGRST116') {
          setError('Entity not found');
        } else {
          setError('Failed to load entity');
        }
        return;
      }

      if (!data) {
        setError('Entity not found');
        return;
      }

      console.log('✅ Entity loaded:', data);
      setEntity(data);

      // Track view in background
      if (user?.id) {
        trackEntityView(data.id, user.id).catch(console.error);
      }
      
    } catch (error) {
      console.error('❌ Unexpected error fetching entity:', error);
      setError('An unexpected error occurred');
      toast({
        title: 'Error',
        description: 'Failed to load entity details',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={`flex-1 ${!isMobile ? 'pl-64' : ''}`}>
          <EntityDetailSkeleton />
        </div>
        
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen flex flex-col">
        {!isMobile && (
          <VerticalTubelightNavbar 
            initialActiveTab="Explore"
            className="fixed left-0 top-0 h-screen pt-4" 
          />
        )}
        
        <div className={`flex-1 ${!isMobile ? 'pl-64' : ''} flex items-center justify-center`}>
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-muted-foreground">
              {error || 'Entity not found'}
            </h1>
            <button
              onClick={() => navigate('/explore')}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Back to Explore
            </button>
          </div>
        </div>
        
        {isMobile && <BottomNavigation />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!isMobile && (
        <VerticalTubelightNavbar 
          initialActiveTab="Explore"
          className="fixed left-0 top-0 h-screen pt-4" 
        />
      )}
      
      <div className={`flex-1 ${!isMobile ? 'pl-64' : ''}`}>
        <EnhancedEntityDisplay entity={entity} />
      </div>
      
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default EntityDetail;
