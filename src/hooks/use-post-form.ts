
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MediaItem } from '@/types/media';
import { Entity } from '@/services/recommendation/types';
import { Json } from '@/integrations/supabase/types';
import { generateUUID } from '@/lib/uuid';

const formSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }).max(100),
  content: z.string().min(1, { message: 'Content is required' }),
  post_type: z.enum(['story', 'routine', 'project', 'note']),
  visibility: z.enum(['public', 'circle_only', 'private']),
  media: z.array(z.any()).optional(),
  tagged_entities: z.array(z.any()).optional(),
});

type FormData = z.infer<typeof formSchema>;

export interface PostToEdit {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

interface UsePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: PostToEdit;
}

export const usePostForm = ({ onSuccess, onCancel, postToEdit }: UsePostFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const sessionId = useState<string>(() => generateUUID())[0];
  const isEditMode = !!postToEdit;
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(postToEdit?.tagged_entities?.[0] || null);
  const [showEntitySelector, setShowEntitySelector] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      post_type: 'story',
      visibility: 'public',
      media: [],
      tagged_entities: [],
    },
  });

  // Set initial selected entity if editing
  useEffect(() => {
    if (postToEdit?.tagged_entities?.[0]) {
      setSelectedEntity(postToEdit.tagged_entities[0]);
    }
  }, [postToEdit]);

  // Initialize form with post data if editing
  useEffect(() => {
    if (postToEdit) {
      form.reset({
        title: postToEdit.title,
        content: postToEdit.content,
        post_type: postToEdit.post_type,
        visibility: postToEdit.visibility,
        tagged_entities: postToEdit.tagged_entities || [],
        media: postToEdit.media || [],
      });
      
      if (postToEdit.tagged_entities) {
        setSelectedEntities(postToEdit.tagged_entities);
      }
      
      if (postToEdit.media) {
        setMediaItems(postToEdit.media);
      }
    }
  }, [postToEdit, form]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      const mediaJson = JSON.parse(JSON.stringify(mediaItems)) as Json;
      
      const postData = {
        title: data.title,
        content: data.content,
        post_type: data.post_type,
        visibility: data.visibility,
        media: mediaJson,
        user_id: user.id,
      };
      
      if (isEditMode) {
        const { error } = await supabase
          .from('posts')
          .update(postData)
          .eq('id', postToEdit.id)
          .eq('user_id', user.id);
          
        if (error) throw error;
        
        if (selectedEntities.length > 0) {
          const { error: deleteError } = await supabase
            .from('post_entities')
            .delete()
            .eq('post_id', postToEdit.id);
            
          if (deleteError) throw deleteError;
          
          for (const entity of selectedEntities) {
            const { error: insertError } = await supabase
              .from('post_entities')
              .insert({
                post_id: postToEdit.id,
                entity_id: entity.id
              });
              
            if (insertError) throw insertError;
          }
        }
        
        toast({ 
          title: 'Post updated!',
          description: 'Your post has been updated successfully.',
        });
      } else {
        const { data: newPost, error } = await supabase
          .from('posts')
          .insert(postData)
          .select()
          .single();
          
        if (error) throw error;
        
        if (selectedEntities.length > 0 && newPost) {
          for (const entity of selectedEntities) {
            const { error: entityError } = await supabase
              .from('post_entities')
              .insert({
                post_id: newPost.id,
                entity_id: entity.id
              });
              
            if (entityError) throw entityError;
          }
        }
        
        toast({ 
          title: 'Post created!',
          description: 'Your post has been published successfully.',
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error submitting post:', error);
      toast({
        title: 'Something went wrong',
        description: 'Your post could not be saved. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMediaUploaded = (media: MediaItem) => {
    setMediaItems(prev => {
      const newMedia = {
        ...media,
        order: prev.length
      };
      return [...prev, newMedia];
    });
  };

  const handleEntitiesChange = (entities: Entity[]) => {
    setSelectedEntities(entities);
  };

  return {
    form,
    isSubmitting,
    selectedEntity,
    setSelectedEntity,
    showEntitySelector,
    setShowEntitySelector,
    mediaItems,
    sessionId,
    isEditMode,
    onSubmit,
    handleMediaUploaded,
    handleEntitiesChange,
  };
};
