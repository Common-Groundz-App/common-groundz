
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { createEnhancedEntity } from '@/services/enhancedEntityService';
import { EntityTypeString } from '@/hooks/feed/api/types';
import { Entity } from '@/services/recommendation/types';
import { v4 as uuidv4 } from 'uuid';

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
      
      // Start background entity creation
      const createdEntity = await createEntityInBackground(externalData, entityType, setCreationProgress, setCreationStage);
      
      if (createdEntity) {
        console.log('✅ Entity created successfully:', createdEntity.name);
        
        // Navigate to actual entity page
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
    console.log('🔄 Starting background entity creation...');
    setProgress(50);
    setStage('Storing photos...');
    
    // Step 1: Create enhanced entity with metadata extraction (includes blocking photo storage)
    const entity = await createEnhancedEntity(externalData, entityType);
    
    if (!entity) {
      setStage('');
      throw new Error('Failed to create entity');
    }
    
    console.log('🎯 Entity created, processing additional enrichment...');
    setProgress(80);
    setStage('Finalizing...');
    
    // Step 2: Background enrichment (non-blocking)
    queueBackgroundEnrichment(entity.id);
    setProgress(100);
    setStage('Complete!');
    
    return entity;
  } catch (error) {
    console.error('❌ Background entity creation failed:', error);
    setStage('');
    throw error;
  }
};

// Queue entity for background enrichment (fire and forget)
const queueBackgroundEnrichment = (entityId: string) => {
  console.log('📋 Queuing entity for background enrichment:', entityId);
  
  // This runs in the background without affecting UI
  setTimeout(async () => {
    try {
      console.log('🔍 Starting background enrichment for entity:', entityId);
      // Additional enrichment operations can be added here
      // For now, just log the completion
      console.log('✨ Background enrichment completed for entity:', entityId);
    } catch (error) {
      console.error('⚠️ Background enrichment failed (non-critical):', error);
    }
  }, 1000);
};
