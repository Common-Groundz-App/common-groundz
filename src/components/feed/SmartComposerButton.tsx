
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Star, Book, Tag, FileText, Eye } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ModernCreatePostForm } from './ModernCreatePostForm';
import { EnhancedCreatePostForm } from './EnhancedCreatePostForm';
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import RecommendationForm from '@/components/recommendations/RecommendationForm';
import { useRecommendationUploads } from '@/hooks/recommendations/use-recommendation-uploads';
import { useToast } from '@/hooks/use-toast';
import { createRecommendation } from '@/services/recommendation/crudOperations';
import { fetchUserProfile } from '@/services/profileService';

interface SmartComposerButtonProps {
  onContentCreated?: () => void;
  onPostCreated?: () => void; // Add compatibility with old prop name
}

type ContentType = 'post' | 'review' | 'journal' | 'recommendation' | 'watching';

export function SmartComposerButton({ onContentCreated, onPostCreated }: SmartComposerButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('post');
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [entityData, setEntityData] = useState<any>(null); // Store entity data for forms
  const { user } = useAuth();
  const { handleImageUpload } = useRecommendationUploads();
  const { toast } = useToast();

  // Fetch the user's profile data when needed
  useEffect(() => {
    const loadProfileData = async () => {
      if (user && (isDialogOpen || isRecommendationFormOpen)) {
        try {
          const profile = await fetchUserProfile(user.id);
          setProfileData(profile);
        } catch (err) {
          console.error('Error fetching profile data:', err);
        }
      }
    };

    if (isDialogOpen || isRecommendationFormOpen) {
      loadProfileData();
    }
  }, [user, isDialogOpen, isRecommendationFormOpen]);

  // Listen for the "open-create-post-dialog" event
  useEffect(() => {
    const handleOpenDialog = (event: Event) => {
      // Check if the event has a detail property with a contentType
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.contentType) {
          setSelectedContentType(customEvent.detail.contentType as ContentType);
          setIsPopoverOpen(false);
          setIsDialogOpen(true);
        }
        
        // Extract entity data if available
        if (customEvent.detail.entity) {
          setEntityData(customEvent.detail.entity);
        }
      } else {
        setSelectedContentType('post');
        setIsPopoverOpen(false);
        setIsDialogOpen(true);
      }
    };
    
    const handleOpenRecommendationForm = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Extract entity data if available
      if (customEvent.detail && customEvent.detail.entity) {
        setEntityData(customEvent.detail.entity);
      }
      setIsRecommendationFormOpen(true);
    };
    
    window.addEventListener('open-create-post-dialog', handleOpenDialog);
    window.addEventListener('open-recommendation-form', handleOpenRecommendationForm);
    
    return () => {
      window.removeEventListener('open-create-post-dialog', handleOpenDialog);
      window.removeEventListener('open-recommendation-form', handleOpenRecommendationForm);
    };
  }, []);

  const handleContentCreated = () => {
    setIsDialogOpen(false);
    
    // Clear entity data
    setEntityData(null);
    
    // Dispatch events to refresh both feeds and profile posts
    window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
    window.dispatchEvent(new CustomEvent('refresh-following-feed'));
    window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
    
    // Call both callback props for compatibility
    if (onContentCreated) onContentCreated();
    if (onPostCreated) onPostCreated();
  };
  
  const handleContentTypeSelect = (type: ContentType) => {
    setSelectedContentType(type);
    setIsPopoverOpen(false);
    setIsDialogOpen(true);
  };

  const handleRecommendationSelect = () => {
    setIsRecommendationFormOpen(true);
    setIsPopoverOpen(false);
  };

  const handleRecommendationSubmit = async (values: any) => {
    if (!user) return;
    
    try {
      await createRecommendation({
        title: values.title,
        venue: values.venue || null,
        description: values.description || null,
        rating: values.rating,
        image_url: values.image_url || null,
        category: values.category,
        visibility: values.visibility,
        is_certified: false,
        view_count: 0,
        user_id: user.id,
        entity_id: values.entity_id || null
      });
      
      toast({
        title: "Recommendation added",
        description: "Your recommendation has been added successfully"
      });
      
      setIsRecommendationFormOpen(false);
      
      // Clear entity data
      setEntityData(null);
      
      // Dispatch events to refresh feeds
      window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
      window.dispatchEvent(new CustomEvent('refresh-following-feed'));
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
      
      // Call callback functions
      if (onContentCreated) onContentCreated();
      if (onPostCreated) onPostCreated();
    } catch (error) {
      console.error("Error adding recommendation:", error);
      toast({
        title: "Error",
        description: "Failed to add recommendation",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            className="bg-brand-orange hover:bg-brand-orange/90 gap-2"
          >
            <PlusCircle size={18} />
            Create
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="end">
          <div className="bg-popover rounded-md shadow-md">
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
              What would you like to create?
            </div>
            <div className="py-1">
              {/* Rearranged order of content type options */}
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={() => handleContentTypeSelect('post')}
              >
                <FileText size={16} className="text-blue-500" />
                <span>Post</span>
              </button>
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={() => handleContentTypeSelect('review')}
              >
                <Star size={16} className="text-yellow-500" />
                <span>Review</span>
              </button>
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={handleRecommendationSelect}
              >
                <Tag size={16} className="text-red-500" />
                <span>Recommendation</span>
              </button>
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={() => handleContentTypeSelect('journal')}
              >
                <Book size={16} className="text-green-500" />
                <span>Journal</span>
              </button>
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={() => handleContentTypeSelect('watching')}
              >
                <Eye size={16} className="text-purple-500" />
                <span>Currently Watching/Using</span>
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {selectedContentType === 'post' && (
            <EnhancedCreatePostForm 
              profileData={profileData}
              onSuccess={handleContentCreated}
              onCancel={() => setIsDialogOpen(false)} 
            />
          )}
          
          {selectedContentType === 'review' && (
            <ReviewForm
              isOpen={isDialogOpen} 
              onClose={() => setIsDialogOpen(false)}
              onSubmit={async () => {
                handleContentCreated();
                return Promise.resolve();
              }}
              entity={entityData}
            />
          )}
          
          {selectedContentType === 'journal' && (
            <ModernCreatePostForm 
              profileData={profileData}
              onSuccess={handleContentCreated}
              onCancel={() => setIsDialogOpen(false)}
              defaultPostType="journal"
            />
          )}
          
          {selectedContentType === 'watching' && (
            <ModernCreatePostForm 
              profileData={profileData}
              onSuccess={handleContentCreated}
              onCancel={() => setIsDialogOpen(false)}
              defaultPostType="watching"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Directly render the RecommendationForm component */}
      {user && (
        <RecommendationForm
          isOpen={isRecommendationFormOpen}
          onClose={() => {
            setIsRecommendationFormOpen(false);
            setEntityData(null);
          }}
          onSubmit={handleRecommendationSubmit}
          onImageUpload={handleImageUpload}
          entity={entityData}
        />
      )}
    </>
  );
}
