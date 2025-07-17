
import { useToast } from '@/hooks/use-toast';

interface ShareEntityData {
  name: string;
  description?: string;
  url: string;
}

export const useEntityShare = () => {
  const { toast } = useToast();

  const shareEntity = async (entityData: ShareEntityData) => {
    const shareData = {
      title: `Check out ${entityData.name}`,
      text: entityData.description || `Discover ${entityData.name} on Common Groundz`,
      url: entityData.url
    };

    // Check if Web Share API is supported
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast({
          title: "Shared successfully",
          description: "Entity shared using your device's share menu"
        });
        return true;
      } catch (error) {
        // User cancelled sharing or error occurred
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fall back to clipboard
          return await copyToClipboard(entityData.url);
        }
        return false;
      }
    } else {
      // Fallback to copying URL to clipboard
      return await copyToClipboard(entityData.url);
    }
  };

  const copyToClipboard = async (url: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied",
          description: "Entity link copied to clipboard"
        });
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        textArea.remove();
        
        if (successful) {
          toast({
            title: "Link copied",
            description: "Entity link copied to clipboard"
          });
          return true;
        } else {
          throw new Error('Copy command failed');
        }
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Copy failed",
        description: "Unable to copy link. Please copy the URL manually.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    shareEntity
  };
};
