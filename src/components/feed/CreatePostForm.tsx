import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { EntityTagSelector } from './EntityTagSelector';
import { MediaItem } from '@/types/media';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaGallery } from '@/components/media/MediaGallery';
import { generateUUID } from '@/lib/uuid';
import { cleanupUnusedMedia } from '@/services/mediaService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { RichTextEditor } from '@/components/editor/RichTextEditor';

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
  const [currentTab, setCurrentTab] = useState<string>('content');
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

  const handleMediaUploaded = (uploadedItem: MediaItem) => {
    setMedia(prevMedia => {
      const updatedMedia = [...prevMedia];
      uploadedItem.order = updatedMedia.length;
      return [...updatedMedia, uploadedItem];
    });
  };
  
  const handleMediaRemove = (index: number) => {
    setMedia(prevMedia => {
      const updatedMedia = [...prevMedia];
      return updatedMedia.map((item, i) => 
        i === index 
          ? { ...item, is_deleted: true } 
          : item
      );
    });
  };
  
  const handleMediaCaptionChange = (index: number, caption: string) => {
    setMedia(prevMedia => {
      return prevMedia.map((item, i) => 
        i === index 
          ? { ...item, caption } 
          : item
      );
    });
  };

  const handleMediaAltChange = (index: number, alt: string) => {
    setMedia(prevMedia => {
      return prevMedia.map((item, i) => 
        i === index 
          ? { ...item, alt } 
          : item
      );
    });
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
        <FormField
          control={form.control}
          name="postType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Type</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select post type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="story">Story</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          rules={{ required: 'Title is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter title for your post" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="pt-2">
            <FormItem>
              <FormLabel>Content</FormLabel>
              <RichTextEditor
                onChange={handleContentChange}
                placeholder="Write your post content here..."
                className="min-h-[150px]"
              />
            </FormItem>
          </TabsContent>
          
          <TabsContent value="media" className="pt-2">
            <div className="space-y-4">
              <MediaUploader
                sessionId={sessionId}
                onMediaUploaded={handleMediaUploaded}
              />
              
              {media.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Media Preview</h3>
                  <MediaGallery
                    media={media}
                    editable={true}
                    onRemove={handleMediaRemove}
                    onCaptionChange={handleMediaCaptionChange}
                    onAltChange={handleMediaAltChange}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Entity Selector */}
        <div className="pt-2 pb-1">
          <EntityTagSelector 
            onEntitiesChange={setSelectedEntities}
          />
        </div>

        <FormField
          control={form.control}
          name="visibility"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Visibility</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="public" id="public" />
                    <FormLabel htmlFor="public" className="font-normal cursor-pointer">
                      Public — Anyone can see this post
                    </FormLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="circle_only" id="circle_only" />
                    <FormLabel htmlFor="circle_only" className="font-normal cursor-pointer">
                      Circle Only — Only people in your circle can see this post
                    </FormLabel>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="private" id="private" />
                    <FormLabel htmlFor="private" className="font-normal cursor-pointer">
                      Private — Only you can see this post
                    </FormLabel>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
