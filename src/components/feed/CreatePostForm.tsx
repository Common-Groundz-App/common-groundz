
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { EntityTagSelector } from './EntityTagSelector';
import { usePostMedia, PostMedia } from '@/hooks/use-post-media';
import { Image, X, Plus, RotateCw } from 'lucide-react';

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type PostFormValues = {
  title: string;
  content: string;
  postType: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
};

export function CreatePostForm({ onSuccess, onCancel }: CreatePostFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<Entity[]>([]);
  const { 
    media, 
    isUploading, 
    handleMediaUpload, 
    removeMedia, 
    updateMediaCaption,
    reorderMedia 
  } = usePostMedia();
  
  const form = useForm<PostFormValues>({
    defaultValues: {
      title: '',
      content: '',
      postType: 'story',
      visibility: 'public',
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const filesArray = Array.from(event.target.files);
    await handleMediaUpload(filesArray);
    
    // Reset the input value so the same file can be selected again if needed
    event.target.value = '';
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
          content: values.content,
          post_type: values.postType,
          visibility: values.visibility,
          user_id: user.id,
          media: media.length > 0 ? media : null
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

  // Function to handle media reordering with drag and drop
  const handleDragEnd = (sourceIndex: number, destinationIndex: number) => {
    if (sourceIndex === destinationIndex) return;
    reorderMedia(sourceIndex, destinationIndex);
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

        <FormField
          control={form.control}
          name="content"
          rules={{ required: 'Content is required' }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Write your post content here..." 
                  className="min-h-[120px]" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Media Uploader */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <FormLabel className="text-sm font-medium">Media</FormLabel>
            <div className="flex gap-2">
              <Input 
                type="file" 
                id="media-upload" 
                multiple 
                accept="image/*,video/*" 
                className="hidden" 
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <label 
                htmlFor="media-upload" 
                className={`flex items-center gap-1 text-sm px-2 py-1 rounded-md cursor-pointer
                  ${isUploading ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
              >
                {isUploading ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span>Add Media</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {media.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
              {media.map((item, index) => (
                <div key={index} className="relative group border rounded-md overflow-hidden">
                  <div className="aspect-video relative">
                    {item.type === 'image' ? (
                      <img 
                        src={item.url} 
                        alt={item.caption || `Media ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video 
                        src={item.url} 
                        controls 
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="sm" 
                        className="h-8 w-8 p-0 rounded-full"
                        onClick={() => removeMedia(index, true)} // true to delete from storage
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    placeholder="Add caption (optional)"
                    className="text-xs border-0 border-t rounded-none bg-background/80"
                    value={item.caption || ''}
                    onChange={(e) => updateMediaCaption(index, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting || isUploading}
            className="bg-brand-orange hover:bg-brand-orange/90"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
