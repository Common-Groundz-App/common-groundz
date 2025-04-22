
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import PostContentViewer from './PostContentViewer';
import RecommendationContentViewer from './RecommendationContentViewer';
import { Loader2 } from 'lucide-react';

const ContentViewerModal = () => {
  const { isOpen, contentType, contentId, commentId, closeContent } = useContentViewer();
  const navigate = useNavigate();
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    
    // Update URL without navigating when modal is opened/closed
    if (isOpen && contentType && contentId) {
      const url = commentId 
        ? `/${contentType}/${contentId}?commentId=${commentId}` 
        : `/${contentType}/${contentId}`;
      
      window.history.pushState({}, '', url);
    } else if (!isOpen) {
      window.history.back();
    }
  }, [isOpen, contentType, contentId, commentId]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = () => {
      closeContent();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeContent]);

  const handleSheetClose = () => {
    closeContent();
  };

  const renderContent = () => {
    if (!contentType || !contentId) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Content not found</p>
        </div>
      );
    }

    switch (contentType) {
      case 'post':
        return <PostContentViewer postId={contentId} highlightCommentId={commentId} />;
      case 'recommendation':
        return <RecommendationContentViewer recommendationId={contentId} highlightCommentId={commentId} />;
      default:
        return (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Unsupported content type</p>
          </div>
        );
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetClose}>
      <SheetContent side="right" className="sm:max-w-xl w-full p-0 overflow-y-auto">
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

export default ContentViewerModal;
