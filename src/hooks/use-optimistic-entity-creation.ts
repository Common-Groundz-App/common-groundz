
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { createEnhancedEntity } from '@/services/enhancedEntityService';
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const createEntityOptimistically = useCallback(async (externalData: any) => {
    console.log('🚀 Starting optimistic entity creation for:', externalData.name);
    
    setIsCreating(true);
    setCreationProgress(10); // Initial progress
    
    try {
      // Start background entity creation immediately (no optimistic navigation)
      const createdEntity = await createEntityInBackground(externalData, entityType, setCreationProgress);
      
      if (createdEntity) {
        console.log('✅ Entity created successfully:', createdEntity.name);
        
        // Check if entity is pending approval
        if (createdEntity.approval_status === 'pending') {
          // Navigate to a submission confirmation page or show success message
          toast({
            title: 'Entity submitted for review',
            description: `${createdEntity.name} has been submitted and is pending approval. You'll be notified when it's approved.`,
          });
          
          // Navigate to home or stay on current page
          navigate('/home');
        } else {
          // Entity is approved, navigate to entity page
          navigate(`/entity/${createdEntity.slug || createdEntity.id}`, { 
            state: { entityCreated: true }
          });
          
          toast({
            title: 'Entity created',
            description: `${createdEntity.name} has been added successfully`,
          });
        }
        
        setCreationProgress(100);
        onEntityCreated?.(createdEntity);
      }
    } catch (error) {
      console.error('❌ Error in optimistic entity creation:', error);
      
      toast({
        title: 'Creation failed',
        description: 'Could not create entity. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
      setCreationProgress(0);
    }
  }, [entityType, navigate, onEntityCreated, toast]);

  return {
    createEntityOptimistically,
    isCreating,
    creationProgress
  };
};

// Background entity creation with progress tracking
const createEntityInBackground = async (
  externalData: any, 
  entityType: EntityTypeString,
  setProgress: (progress: number) => void
): Promise<Entity | null> => {
  try {
    console.log('🔄 Starting background entity creation...');
    setProgress(40);
    
    // Get current user ID for user-created entities
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;
    
    // Step 1: Create enhanced entity with metadata extraction and user context
    const entity = await createEnhancedEntity(externalData, entityType, userId);
    setProgress(70);
    
    if (!entity) {
      throw new Error('Failed to create entity');
    }
    
    console.log('🎯 Entity created, processing additional enrichment...');
    
    // Step 2: Background enrichment (non-blocking)
    queueBackgroundEnrichment(entity.id);
    setProgress(100);
    
    return entity;
  } catch (error) {
    console.error('❌ Background entity creation failed:', error);
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
