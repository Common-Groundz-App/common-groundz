
import React from 'react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { PostEntitySection } from './post-form/PostEntitySection';
import { PostMediaSection } from './post-form/PostMediaSection';
import { PostFormFooter } from './post-form/PostFormFooter';
import { usePostForm } from '@/hooks/use-post-form';

interface CreatePostFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  postToEdit?: import('@/hooks/use-post-form').PostToEdit;
}

export function CreatePostForm({ onSuccess, onCancel, postToEdit }: CreatePostFormProps) {
  const {
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
  } = usePostForm({ onSuccess, onCancel, postToEdit });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Add a title..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <RichTextEditor
                  onChange={field.onChange}
                  value={field.value}
                  placeholder="What's on your mind?"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <PostMediaSection
          isEditMode={isEditMode}
          mediaItems={mediaItems}
          sessionId={sessionId}
          onMediaUploaded={handleMediaUploaded}
        />
        
        <PostEntitySection
          selectedEntity={selectedEntity}
          showEntitySelector={showEntitySelector}
          setSelectedEntity={setSelectedEntity}
          setShowEntitySelector={setShowEntitySelector}
          setValue={form.setValue}
        />
        
        <div className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="post_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
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
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="circle_only">Circle Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <PostFormFooter 
          isSubmitting={isSubmitting}
          isEditMode={isEditMode}
          onCancel={onCancel}
        />
      </form>
    </Form>
  );
}
