
import React, { useEffect, useState } from 'react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import PostContentViewer from './PostContentViewer';
import RecommendationContentViewer from './RecommendationContentViewer';
import { X } from 'lucide-react';

const ContentViewerModal = () => {
  const { isOpen, contentType, contentId, commentId, closeContent } = useContentViewer();
  const [mounted, setMounted] = useState(false);

  // Animation mounting for fade/slide in
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setMounted(true), 15); // Enable animation after mount
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  // Restore history on close
  useEffect(() => {
    if (isOpen && contentType && contentId) {
      const url = commentId 
        ? `/${contentType}/${contentId}?commentId=${commentId}` 
        : `/${contentType}/${contentId}`;
      window.history.pushState({}, '', url);
    } else if (!isOpen) {
      window.history.back();
    }
    // eslint-disable-next-line
  }, [isOpen, contentType, contentId, commentId]);

  // Browser back button closes modal
  useEffect(() => {
    const handlePopState = () => closeContent();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeContent]);

  // Prevent background scroll when modal open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Content logic
  let content = (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Content not found</p>
    </div>
  );
  
  if (contentType && contentId) {
    if (contentType === 'post') {
      content = <PostContentViewer postId={contentId} highlightCommentId={commentId} />;
    } else if (contentType === 'recommendation') {
      content = <RecommendationContentViewer recommendationId={contentId} highlightCommentId={commentId} />;
    } else {
      content = (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Unsupported content type</p>
        </div>
      );
    }
  }

  // Animations utility classes (fade+scale in)
  const modalAnimationClass = mounted 
    ? 'opacity-100 translate-y-0 scale-100'
    : 'opacity-0 translate-y-6 scale-95';

  return (
    <div
      aria-modal="true"
      role="dialog"
      className="
        fixed inset-0 z-[100] flex items-center justify-center
        bg-black/40 backdrop-blur-md
        animate-fade-in
      "
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          closeContent();
        }
      }}
      style={{
        transition: 'background 0.3s cubic-bezier(.4,0,.2,1)'
      }}
    >
      {/* Modal Card */}
      <div
        className={`
          relative bg-background rounded-xl shadow-2xl flex flex-col
          max-w-2xl w-full mx-auto
          p-0 sm:p-0
          transition-all duration-300
          ${modalAnimationClass}
          h-fit max-h-[96vh]
          sm:p-6
        `}
        style={{
          transition: 'all 0.3s cubic-bezier(.4,0,.2,1)'
        }}
      >
        {/* Close button */}
        <button
          aria-label="Close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeContent();
          }}
          className="
            absolute top-4 right-4 z-10
            bg-black/40 hover:bg-black/70 text-white rounded-full p-2
            transition
            focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X size={22} />
        </button>
        {/* Content */}
        <div className="w-full">
          {content}
        </div>
      </div>
      {/* Mobile full-screen override */}
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
