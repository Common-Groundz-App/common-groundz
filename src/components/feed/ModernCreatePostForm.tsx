
import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ImageIcon, X } from 'lucide-react';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';

interface ModernCreatePostFormProps {
  onSuccess?: () => void;
  initialContent?: string;
  postToEdit?: any;
  onCancel?: () => void;
  defaultPostType?: string;
  profileData?: any;
}

const ModernCreatePostForm: React.FC<ModernCreatePostFormProps> = ({ 
  onSuccess, 
  initialContent,
  postToEdit,
  onCancel,
  defaultPostType,
  profileData
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState(initialContent || postToEdit?.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(postToEdit?.image_url || null);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewImageUrl(null);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "You must be logged in to create a post.",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please enter some content for your post.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl: string | undefined = undefined;

      // For now, skip image upload functionality since uploadthing is not available
      if (selectedFile) {
        toast({
          title: "Image upload temporarily unavailable",
          description: "Image upload feature is currently being updated.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      const endpoint = postToEdit ? '/api/updatePost' : '/api/createPost';
      const body = postToEdit 
        ? { id: postToEdit.id, content, imageUrl }
        : { content, imageUrl, post_type: defaultPostType || 'post' };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({
          title: postToEdit ? "Post updated" : "Post created",
          description: `Your post has been ${postToEdit ? 'updated' : 'created'} successfully.`,
        });
        setContent('');
        setSelectedFile(null);
        setPreviewImageUrl(null);
        if (onSuccess) {
          onSuccess();
        }
      } else {
        const errorData = await response.json();
        toast({
          title: `Failed to ${postToEdit ? 'update' : 'create'} post`,
          description: errorData.message || "An error occurred while processing the post.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Post operation error:", error);
      toast({
        title: `Failed to ${postToEdit ? 'update' : 'create'} post`,
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <ProfileAvatar 
              userId={user?.id}
              size="md"
              className="border-2 border-background shadow-sm"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <Textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={handleContentChange}
              rows={3}
              className="resize-none border-none shadow-none focus-visible:ring-0 focus-visible:ring-transparent"
            />
            {previewImageUrl && (
              <div className="relative mt-2">
                <img
                  src={previewImageUrl}
                  alt="Preview"
                  className="w-full rounded-md aspect-video object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background hover:bg-secondary rounded-full"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex justify-between items-center mt-2">
              <div>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <label htmlFor="image-upload">
                  <Button variant="ghost" size="sm" disabled={isSubmitting} asChild>
                    <span>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Add Image
                    </span>
                  </Button>
                </label>
              </div>
              <div className="flex gap-2">
                {onCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !content.trim()}
                >
                  {isSubmitting ? 'Posting...' : (postToEdit ? 'Update' : 'Post')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ModernCreatePostForm;
