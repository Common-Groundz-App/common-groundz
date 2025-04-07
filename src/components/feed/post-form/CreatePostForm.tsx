import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { generateUUID } from '@/lib/uuid';
import { Save } from 'lucide-react';
import { Form } from '@/components/ui/form';
import { PostTypeSelector } from './PostTypeSelector';
import { PostTitleField } from './PostTitleField';
import { PostContentTabs } from './PostContentTabs';
import { EntityTagSelector } from '@/components/feed/EntityTagSelector';
import { PostVisibilitySelector } from './PostVisibilitySelector';

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type PostFormValues = {
  title: string;
  postType: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  status: 'draft' | 'published' | 'failed';
};

export function CreatePostForm({ onSuccess, onCancel }: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [contentJson, setContentJson] = useState<object>({});
  const [contentHtml, setContentHtml] = useState<string>('');
  
  // Initialize session ID for media uploads
  useEffect(() => {
    const newSessionId = generateUUID();
    setSessionId(newSessionId);
    console.log('New session ID created:', newSessionId);
    
    return () => {
      // Cleanup unused media when component unmounts
      if (user && sessionId) {
        console.log('Cleanup may be needed for session:', sessionId);
        // We're deferring full cleanup until draft support is ready
        // But we'll keep the mechanism in place for future use
        // cleanupUnusedMedia(user.id, sessionId).catch(console.error);
      }
    };
  }, [user]);
  
  const form = useForm<PostFormValues>({
    defaultValues: {
      title: '',
      postType: 'story',
      visibility: 'public',
      status: 'published',
    }
  });

  const handleMediaUpdate = (updatedMedia: MediaItem[]) => {
    setMedia(updatedMedia);
  };

  const handleContentChange = (json: object, html: string) => {
    setContentJson(json);
    setContentHtml(html);
  };
  
  const handleDraftSave = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save a draft',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const values = form.getValues();
      
      // Insert the post as a draft
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          title: values.title,
          content: contentJson, // Store rich text content as JSON
          post_type: values.postType,
          visibility: values.visibility,
          user_id: user.id,
          status: 'draft',
          media: media.filter(m => !m.is_deleted),
        } as any)
        .select()
        .single();

      if (postError) throw postError;
      
      toast({
        title: 'Draft saved',
        description: 'Your post draft has been saved',
      });
      
      form.reset();
      setSelectedEntities([]);
      setMedia([]);
      setContentJson({});
      setContentHtml('');
      
      // Generate a new session ID to prevent cleanup of used media
      const newSessionId = generateUUID();
      setSessionId(newSessionId);
      console.log('New session ID created after draft save:', newSessionId);
      
      onSuccess();
      
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: 'Failed to save draft',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const onSubmit = async (values: PostFormValues) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a post',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Insert the post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          title: values.title,
          content: contentJson, // Store rich text content as JSON
          post_type: values.postType,
          visibility: values.visibility,
          user_id: user.id,
          status: 'published',
          media: media.filter(m => !m.is_deleted),
        } as any)
        .select()
        .single();

      if (postError) throw postError;
      
      // If entities are selected, associate them with the post
      if (selectedEntities.length > 0 && postData) {
        // Use type casting with any to bypass TypeScript's type checking
        const supabaseAny = supabase as any;
        
        const entityPromises = selectedEntities.map(entity => 
          supabaseAny
            .rpc('insert_post_entity', {
              p_post_id: postData.id,
              p_entity_id: entity.id
            })
        );
        
        await Promise.all(entityPromises);
      }

      toast({
        title: 'Success!',
        description: 'Your post has been created',
      });
      
      form.reset();
      setSelectedEntities([]);
      setMedia([]);
      setContentJson({});
      setContentHtml('');
      
      // Generate a new session ID to prevent cleanup of used media
      const newSessionId = generateUUID();
      setSessionId(newSessionId);
      console.log('New session ID created after post publish:', newSessionId);

      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Failed to create post',
        description: 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <PostTypeSelector control={form.control} />
        <PostTitleField control={form.control} />
        
        <PostContentTabs 
          sessionId={sessionId}
          media={media}
          onMediaUpdate={handleMediaUpdate}
          onContentChange={handleContentChange}
        />

        {/* Entity Selector */}
        <div className="pt-2 pb-1">
          <EntityTagSelector 
            onEntitiesChange={setSelectedEntities}
          />
        </div>

        <PostVisibilitySelector control={form.control} />

        <div className="flex justify-end gap-2 pt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDraftSave}
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <Save size={16} />
            Save Draft
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-brand-orange hover:bg-brand-orange/90"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
