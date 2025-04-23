import React, { useEffect, useRef, useState } from 'react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import PostContentViewer from './PostContentViewer';
import RecommendationContentViewer from './RecommendationContentViewer';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const MODAL_MAX_WIDTH = 'max-w-2xl';

const ContentViewerModal = () => {
  const { isOpen, contentType, contentId, commentId, closeContent } = useContentViewer();
  const [mounted, setMounted] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setMounted(true), 15);
    } else {
      setMounted(false);
    }
  }, [isOpen]);

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

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContent();
    };
    if (isOpen) {
      window.addEventListener('keydown', onEsc);
    }
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, closeContent]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closeContent();
  };

  let content = (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Content not found</p>
    </div>
  );
  if (contentType && contentId) {
    if (contentType === 'post') {
      content = <PostContentViewer postId={contentId} highlightCommentId={commentId} isModal={true} />;
    } else if (contentType === 'recommendation') {
      content = <RecommendationContentViewer recommendationId={contentId} highlightCommentId={commentId} isModal={true} />;
    } else {
      content = (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Unsupported content type</p>
        </div>
      );
    }
  }

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 40 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
    exit: { opacity: 0, scale: 0.97, y: 30, transition: { duration: 0.18 } }
  };

  const cardClass =
    "w-full bg-background rounded-xl shadow-2xl flex flex-col h-fit max-h-[96vh] overflow-hidden " +
    "transition-all duration-300 " +
    MODAL_MAX_WIDTH +
    " mx-auto p-0 sm:p-6";

  const mobileModalClass = "sm:rounded-xl sm:max-w-2xl sm:p-6 rounded-none max-w-full h-full min-h-screen p-4";

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={overlayRef}
          aria-modal="true"
          role="dialog"
          tabIndex={-1}
          className={`
            fixed inset-0 z-[100] flex items-center justify-center
            bg-black/40 backdrop-blur-md
            transition-all duration-200
          `}
          style={{
            WebkitBackdropFilter: 'blur(8px)',
            backdropFilter: 'blur(8px)'
          }}
          onClick={handleOverlayClick}
        >
          <motion.div
            ref={modalRef}
            className={`
              ${cardClass}
              modal-immersive
              transition-all ease-out
              ${/* On mobile, go full screen */''}
              sm:p-6 p-4
            `}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            style={{
              borderRadius: '1.25rem',
              position: 'relative',
              minHeight: '0',
              width: '100%',
              maxWidth: '640px',
            }}
          >
            <button
              aria-label="Close"
              onClick={closeContent}
              className="
                absolute top-4 right-4 z-10
                bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition
                shadow-md
                focus:outline-none focus:ring-2 focus:ring-primary
                sm:top-4 sm:right-4
                top-4 right-4
                w-10 h-10 flex items-center justify-center
              "
            >
              <X size={26} />
            </button>
            <div className="w-full">
              {content}
            </div>
          </motion.div>
          <style>
            {`
              @media (max-width: 640px) {
                .modal-immersive {
                  border-radius: 0 !important;
                  max-width: 100vw !important;
                  width: 100vw !important;
                  height: 100vh !important;
                  min-height: 100vh !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  overflow-y: auto !important;
                }
              }
            `}
          </style>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ContentViewerModal;
