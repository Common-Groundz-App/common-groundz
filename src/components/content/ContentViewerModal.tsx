import * as React from 'react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import PostContentViewer from './PostContentViewer';
import RecommendationContentViewer from './RecommendationContentViewer';
import { X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildContentPath } from '@/utils/contentViewerRoutes';

/**
 * The single app-wide content viewer. Mounted once in App.tsx inside the
 * Router and ContentViewerProvider. Never render more than one instance.
 */
const ContentViewerModal = () => {
  const { isOpen, contentType, contentId, commentId, closeContent } = useContentViewer();
  const [mounted, setMounted] = React.useState(false);
  const navigate = useNavigate();

  // True only while THIS instance owns a history entry it pushed itself.
  const ownsHistoryRef = React.useRef(false);
  // The URL that was current before we pushed, used for non-navigating restore.
  const restoreUrlRef = React.useRef<string | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  const resetBodyPointerEvents = React.useCallback(() => {
    if (document.body.style.pointerEvents === 'none') {
      document.body.style.pointerEvents = '';
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setMounted(true), 15);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [isOpen]);

  // ---- Explicit history ownership -------------------------------------
  React.useEffect(() => {
    const path = buildContentPath(contentType, contentId, commentId, { modal: true });

    if (isOpen && path) {
      if (!ownsHistoryRef.current) {
        restoreUrlRef.current = window.location.pathname + window.location.search;
        window.history.pushState({ contentViewer: true }, '', path);
        ownsHistoryRef.current = true;
      } else {
        // Content changed while already open: swap in place, never stack.
        window.history.replaceState({ contentViewer: true }, '', path);
      }
      return;
    }

    // Closed (or unsupported type) while we still own the entry: restore the
    // URL without navigating. Never call history.back() here.
    if (!isOpen && ownsHistoryRef.current) {
      ownsHistoryRef.current = false;
      if (restoreUrlRef.current) {
        window.history.replaceState({}, '', restoreUrlRef.current);
      }
      restoreUrlRef.current = null;
    }
  }, [isOpen, contentType, contentId, commentId]);

  // Browser Back: release ownership first so the close path can't loop.
  React.useEffect(() => {
    const handlePopState = () => {
      ownsHistoryRef.current = false;
      restoreUrlRef.current = null;
      resetBodyPointerEvents();
      closeContent();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeContent, resetBodyPointerEvents]);

  // Unmount: release ownership without navigating anywhere.
  React.useEffect(() => {
    return () => {
      ownsHistoryRef.current = false;
      restoreUrlRef.current = null;
    };
  }, []);

  // Close button / backdrop / Escape.
  const requestClose = React.useCallback(() => {
    resetBodyPointerEvents();
    if (ownsHistoryRef.current) {
      ownsHistoryRef.current = false;
      restoreUrlRef.current = null;
      window.history.back();
      closeContent();
      return;
    }
    closeContent();
  }, [closeContent, resetBodyPointerEvents]);

  // ---- Body scroll lock ------------------------------------------------
  React.useEffect(() => {
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
  }, [isOpen, resetBodyPointerEvents]);

  // ---- Escape + focus management --------------------------------------
  React.useEffect(() => {
    if (!isOpen) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = setTimeout(() => dialogRef.current?.focus(), 20);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const previous = lastFocusedRef.current;
      lastFocusedRef.current = null;
      if (previous && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [isOpen, requestClose]);

  const fullPagePath = buildContentPath(contentType, contentId, commentId);

  const handleViewFullPage = () => {
    if (!fullPagePath) return;
    const replaceModalEntry = ownsHistoryRef.current;
    ownsHistoryRef.current = false;
    restoreUrlRef.current = null;
    resetBodyPointerEvents();
    closeContent();
    navigate(fullPagePath, { replace: replaceModalEntry });
  };

  if (!isOpen) return null;

  let content = (
    <div className="flex h-full items-center justify-center py-10">
      <p className="text-muted-foreground">Content not found</p>
    </div>
  );

  if (contentType && contentId) {
    if (contentType === 'post') {
      content = <PostContentViewer postId={contentId} highlightCommentId={commentId} isInModal={true} />;
    } else if (contentType === 'recommendation') {
      content = <RecommendationContentViewer recommendationId={contentId} highlightCommentId={commentId} isInModal={true} />;
    } else {
      content = (
        <div className="flex h-full items-center justify-center py-10">
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          requestClose();
        }
      }}
      style={{ transition: 'background 0.3s cubic-bezier(.4,0,.2,1)' }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        role="dialog"
        aria-describedby="content-viewer-description"
        className={`
          relative bg-background rounded-xl shadow-2xl flex flex-col
          max-w-2xl w-full mx-auto outline-none
          transition-all duration-300
          ${modalAnimationClass}
          h-fit max-h-[96vh]
          sm:p-6
        `}
        style={{ transition: 'all 0.3s cubic-bezier(.4,0,.2,1)' }}
      >
        <div id="content-viewer-description" className="sr-only">
          Content viewer modal for {contentType} content
        </div>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          {fullPagePath && (
            <button
              aria-label="View full page"
              title="View full page"
              onClick={handleViewFullPage}
              className="
                w-8 h-8 rounded-full
                flex items-center justify-center
                hover:bg-muted
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
          <button
            aria-label="Close"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              requestClose();
            }}
            className="
              w-8 h-8 rounded-full
              flex items-center justify-center
              hover:bg-muted
              transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full overflow-y-auto">
          {content}
        </div>
      </div>
    </div>
  );
};

export default ContentViewerModal;
