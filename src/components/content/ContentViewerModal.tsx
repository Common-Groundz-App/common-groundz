
import React, { useEffect, useState } from 'react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import PostContentViewer from './PostContentViewer';
import RecommendationContentViewer from './RecommendationContentViewer';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

const ContentViewerModal = () => {
  const { isOpen, contentType, contentId, commentId, closeContent } = useContentViewer();
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const [isInteractingWithContent, setIsInteractingWithContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setMounted(true), 15);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && contentType && contentId) {
      const url = commentId 
        ? `/${contentType}/${contentId}?commentId=${commentId}&modal=true` 
        : `/${contentType}/${contentId}?modal=true`;
      window.history.pushState({}, '', url);
    } else if (!isOpen) {
      window.history.back();
    }
  }, [isOpen, contentType, contentId, commentId]);

  useEffect(() => {
    const handlePopState = () => {
      resetBodyPointerEvents();
      closeContent();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeContent]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      resetBodyPointerEvents();
    }
    return () => {
      document.body.style.overflow = '';
      resetBodyPointerEvents();
    };
  }, [isOpen]);

  const handleViewFullPage = (e: React.MouseEvent) => {
    // Don't navigate if the user is interacting with internal components
    if (isInteractingWithContent) return;
    
    const fullPageUrl = commentId 
      ? `/${contentType}/${contentId}?commentId=${commentId}` 
      : `/${contentType}/${contentId}`;
    
    resetBodyPointerEvents();
    closeContent();
    navigate(fullPageUrl);
  };

  // Tell parent components that we're currently interacting with content
  const handleContentInteraction = (interacting: boolean) => {
    setIsInteractingWithContent(interacting);
  };

  if (!isOpen) return null;

  let content = (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Content not found</p>
    </div>
  );
  
  if (contentType && contentId) {
    if (contentType === 'post') {
      content = <PostContentViewer 
                  postId={contentId} 
                  highlightCommentId={commentId} 
                  isInModal={true} 
                  onInteractionStateChange={handleContentInteraction}
                />;
    } else if (contentType === 'recommendation') {
      content = <RecommendationContentViewer 
                  recommendationId={contentId} 
                  highlightCommentId={commentId} 
                  isInModal={true} 
                  onInteractionStateChange={handleContentInteraction} 
                />;
    } else {
      content = (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Unsupported content type</p>
        </div>
      );
    }
  }

  const modalAnimationClass = mounted 
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 translate-y-6 scale-95';

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-describedby="content-viewer-description"
      className="
        fixed inset-0 z-[90] flex items-center justify-center
        bg-black/40 backdrop-blur-md
        animate-fade-in
      "
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          resetBodyPointerEvents();
          closeContent();
        }
      }}
      style={{
        transition: 'background 0.3s cubic-bezier(.4,0,.2,1)'
      }}
    >
      <div id="content-viewer-description" className="sr-only">
        Content viewer modal for {contentType} content
      </div>
      
      <div
        className={`
          relative bg-background rounded-xl shadow-2xl flex flex-col
          max-w-2xl w-full mx-auto cursor-pointer
          transition-all duration-300
          ${modalAnimationClass}
          h-fit max-h-[96vh]
          sm:p-6
        `}
        style={{
          transition: 'all 0.3s cubic-bezier(.4,0,.2,1)'
        }}
        onClick={handleViewFullPage}
      >
        <button
          aria-label="Close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            resetBodyPointerEvents();
            closeContent();
          }}
          className="
            absolute top-4 right-4 z-10
            w-8 h-8 rounded-full
            flex items-center justify-center
            hover:bg-gray-100 dark:hover:bg-gray-800
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <div className="w-full">
          {content}
        </div>
      </div>
      
      <style>
        {`
        @media (max-width: 640px) {
          .modal-mobile-focus {
            border-radius: 0 !important;
            max-width: 100vw !important;
            height: 100vh !important;
            min-height: 100vh !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
        `}
      </style>
    </div>
  );
};

export default ContentViewerModal;
