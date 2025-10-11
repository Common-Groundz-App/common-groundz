
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { createEntityQuick } from '@/services/enhancedEntityService';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { Entity } from '@/services/recommendation/types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';

interface OptimisticEntityCreationProps {
  entityType: EntityTypeString;
  onEntityCreated?: (entity: Entity) => void;
}

export const useOptimisticEntityCreation = ({ 
  entityType, 
  onEntityCreated 
}: OptimisticEntityCreationProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [creationStage, setCreationStage] = useState<string>('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const createEntityOptimistically = useCallback(async (externalData: any) => {
    console.log('🚀 Starting optimistic entity creation for:', externalData.name);
    
    // Generate temporary ID for immediate navigation
    const tempEntityId = `temp-${uuidv4()}`;
    const tempSlug = externalData.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    
    setIsCreating(true);
    setCreationProgress(10); // Initial progress
    
    try {
      // Navigate immediately to entity page with optimistic data
      navigate(`/entity/${tempSlug}`, { 
        state: { 
          optimisticEntity: {
            id: tempEntityId,
            name: externalData.name,
            type: entityType,
            venue: externalData.venue,
            description: externalData.description,
            image_url: externalData.image_url,
            isOptimistic: true,
            metadata: externalData.metadata
          },
          creationInProgress: true
        }
      });
      
      setCreationProgress(25);
      setCreationStage('Creating entity...');
      
      // Start entity creation (photo storage happens in background now)
      const createdEntity = await createEntityInBackground(externalData, entityType, setCreationProgress, setCreationStage);
      
      if (createdEntity) {
        console.log('✅ Entity created successfully:', createdEntity.name);
        
        // CRITICAL: Navigate FIRST with entityCreated flag (triggers polling)
        navigate(`/entity/${createdEntity.slug || createdEntity.id}`, { 
          replace: true,
          state: { entityCreated: true }
        });
        
        setCreationProgress(100);
        onEntityCreated?.(createdEntity);
        
        toast({
          title: 'Entity created',
          description: `${createdEntity.name} has been added successfully`,
        });
        
        // THEN schedule background enrichment AFTER navigation
        setTimeout(() => {
          enrichEntityInBackground(createdEntity.id, externalData, entityType);
        }, 3000); // 3 seconds after navigation completes
      }
    } catch (error) {
      console.error('❌ Error in optimistic entity creation:', error);
      
      toast({
        title: 'Creation failed',
        description: 'Could not create entity. Please try again.',
        variant: 'destructive'
      });
      
      // Navigate back or show error state
      navigate(-1);
    } finally {
      setIsCreating(false);
      setCreationProgress(0);
      setCreationStage('');
    }
  }, [entityType, navigate, onEntityCreated, toast]);

  return {
    createEntityOptimistically,
    isCreating,
    creationProgress,
    creationStage
  };
};

// Background entity creation with progress tracking
const createEntityInBackground = async (
  externalData: any, 
  entityType: EntityTypeString,
  setProgress: (progress: number) => void,
  setStage: (stage: string) => void
): Promise<Entity | null> => {
  try {
    console.log('🔄 Quick entity creation...');
    setProgress(50);
    setStage('Creating entity...');
    
    // Step 1: QUICK entity creation (database INSERT only, ~500ms)
    const entity = await createEntityQuick(externalData, entityType);
    
    if (!entity) {
      setStage('');
      throw new Error('Failed to create entity');
    }
    
    console.log('✅ Entity created:', entity.id);
    setProgress(100);
    setStage('Complete!');
    
    // Return immediately - enrichment will be scheduled AFTER navigation
    return entity;
  } catch (error) {
    console.error('❌ Entity creation failed:', error);
    setStage('');
    throw error;
  }
};

// NEW: Full background enrichment (photos + metadata)
const enrichEntityInBackground = (
  entityId: string,
  externalData: any,
  entityType: EntityTypeString
) => {
  console.log('🖼️ Starting background enrichment for:', entityId);
  
  // For Google Places entities, trigger photo storage and metadata enrichment
  if (externalData.api_source === 'google_places' && externalData.api_ref) {
    console.log('🖼️ Triggering background photo storage for entity:', entityId);
    
    // Fire-and-forget: Don't await, just start the process
    supabase.functions.invoke('refresh-google-places-entity', {
      body: { 
        entityId, 
        placeId: externalData.api_ref 
      }
    }).then(({ data: refreshResult, error: refreshError }) => {
      if (refreshError) {
        console.error('❌ Background enrichment failed:', refreshError);
      } else if (refreshResult?.updatedMetadata?.stored_photo_urls) {
        console.log('✅ Background enrichment completed:', {
          entityId,
          storedCount: refreshResult.updatedMetadata.stored_photo_urls.length
        });
      } else {
        console.warn('⚠️ Enrichment completed but no stored URLs returned');
      }
    }).catch(error => {
      console.error('⚠️ Background enrichment exception:', error);
    });
  }
  
  console.log('✨ Background enrichment started (non-blocking)');
};
