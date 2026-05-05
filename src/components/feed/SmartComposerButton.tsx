import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlusCircle, Star, FileText } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

type ContentType = 'review' | 'recommendation';

export function SmartComposerButton({ onContentCreated, onPostCreated }: SmartComposerButtonProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('review');
  const [isRecommendationFormOpen, setIsRecommendationFormOpen] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [entityData, setEntityData] = useState<any>(null); // Store entity data for forms
  const { handleImageUpload } = useRecommendationUploads();
  const { toast } = useToast();

  console.log('✏️ [SmartComposerButton] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  // CRITICAL: Don't render button until auth is ready
  if (isLoading) {
    console.log('⏳ [SmartComposerButton] Auth loading, showing skeleton...');
    return (
      <Button disabled className="bg-muted text-muted-foreground gap-2">
        <PlusCircle size={18} />
        Loading...
      </Button>
    );
  }

  // Don't render if no user
  if (!user) {
    console.log('❌ [SmartComposerButton] No user, not rendering button');
    return null;
  }

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

  // Listen for the "open-create-post-dialog" event — only for non-post types now
  useEffect(() => {
    const handleOpenDialog = (event: Event) => {
      const detail = (event as CustomEvent)?.detail ?? {};
      const contentType = detail.contentType ?? 'post';

      // Posts now go to /create route
      if (contentType === 'post') {
        const params = new URLSearchParams();
        if (detail.entityId) params.set('entityId', detail.entityId);
        if (detail.entityName) params.set('entityName', detail.entityName);
        if (detail.entityType) params.set('entityType', detail.entityType);
        const qs = params.toString();
        navigate(`/create${qs ? `?${qs}` : ''}`);
        return;
      }

      setSelectedContentType(contentType as ContentType);
      setIsPopoverOpen(false);
      setIsDialogOpen(true);

      // Support both payload shapes + reset stale data
      if (detail.entity) {
        const normalizedId = detail.entity.id ?? detail.entity.entity_id;
        setEntityData({
          ...detail.entity,
          id: normalizedId,
          name: detail.entity.name ?? '',
          type: detail.entity.type ?? 'product',
        });
      } else if (detail.entityId) {
        setEntityData({
          id: detail.entityId,
          name: detail.entityName ?? '',
          type: detail.entityType ?? 'product',
        });
      } else {
        setEntityData(null);
      }
    };
    
    const handleOpenRecommendationForm = (event: Event) => {
      const customEvent = event as CustomEvent;
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
  }, [navigate]);

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
                onClick={() => {
                  setIsPopoverOpen(false);
                  navigate('/create');
                }}
              >
                <FileText size={16} className="text-blue-500" />
                <span>Post</span>
              </button>
              <button
                className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent gap-2 transition-colors"
                onClick={() => {
                  handleContentTypeSelect('review');
                }}
              >
                <Star size={16} className="text-yellow-500" />
                <span>Review</span>
              </button>
            </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Review still uses an in-page dialog. Journal/Watching/Post all
          navigate to /create (handled in popover + 'open-create-post-dialog'
          listener), so the legacy ModernCreatePostForm dialog branches were
          removed when the composer was unified onto EnhancedCreatePostForm. */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
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
