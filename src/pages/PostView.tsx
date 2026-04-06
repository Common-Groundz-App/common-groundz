import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import GuestNavBar from '@/components/profile/GuestNavBar';
import Footer from '@/components/Footer';
import PostContentViewer from '@/components/content/PostContentViewer';
import PostDetailSidebar from '@/components/content/PostDetailSidebar';
import PublicContentNotFound from '@/components/content/PublicContentNotFound';
import SEOHead from '@/components/seo/SEOHead';
import Logo from '@/components/Logo';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

interface PostMeta {
  title: string;
  content: string;
  visibility: string;
  imageUrl?: string;
  authorId?: string;
  taggedEntities?: any[];
}

const PostView = () => {
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const commentId = searchParams.get('commentId');
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const [postMeta, setPostMeta] = useState<PostMeta | null>(null);
  const [loadComplete, setLoadComplete] = useState(false);
  const hasTracked = useRef(false);

  // Reset state when route param changes
  useEffect(() => {
    setPostMeta(null);
    setLoadComplete(false);
    hasTracked.current = false;
  }, [postId]);

  const handlePostLoaded = useCallback((meta: PostMeta | null) => {
    setPostMeta(meta);
    setLoadComplete(true);
  }, []);

  // Idempotent guest tracking
  useEffect(() => {
    if (!user && loadComplete && postMeta?.visibility === 'public' && !hasTracked.current) {
      hasTracked.current = true;
    }
  }, [user, loadComplete, postMeta]);

  const isPublic = postMeta?.visibility === 'public';

  // Hard 404 for guests viewing non-public content
  if (!postId || (loadComplete && !user && (!postMeta || !isPublic))) {
    return (
      <div className="min-h-screen flex flex-col">
        <GuestNavBar />
        <PublicContentNotFound
          title="Post Not Found"
          description="The requested post could not be found or is not publicly available."
        />
        <Footer />
      </div>
    );
  }

  // SEO
  const seoTitle = postMeta?.title ? `${postMeta.title} — Common Groundz` : 'Post — Common Groundz';
  const seoDescription = postMeta?.content
    ? postMeta.content.substring(0, 155).replace(/\n/g, ' ')
    : 'View this post on Common Groundz';

  // Guest layout — simple, no app shell
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col">
        <SEOHead
          title={seoTitle}
          description={seoDescription}
          image={postMeta?.imageUrl}
          type="article"
          noindex={!loadComplete || !isPublic}
          canonical={isPublic ? `${window.location.origin}/post/${postId}` : undefined}
        />
        <GuestNavBar />
        <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
          <PostContentViewer
            postId={postId}
            highlightCommentId={commentId}
            onPostLoaded={handlePostLoaded}
            isDetailView
          />
        </div>
        <Footer />
      </div>
    );
  }

  // Logged-in layout — app shell matching Feed.tsx
  return (
    <div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        image={postMeta?.imageUrl}
        type="article"
        noindex={!loadComplete || !isPublic}
        canonical={isPublic ? `${window.location.origin}/post/${postId}` : undefined}
      />

      {/* Mobile Header */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-between items-center">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-search-dialog'))}
              className="p-2 rounded-full hover:bg-accent"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-notifications'))}
              className="p-2 rounded-full hover:bg-accent relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Desktop Left Nav */}
        <div className="hidden xl:block">
          <VerticalTubelightNavbar className="fixed left-0 top-0 h-screen pt-4 pl-4 z-50" />
        </div>

        <div className="flex-1 pt-16 xl:pt-0 xl:ml-64 min-w-0">
          {/* Three-column grid on desktop */}
          <div className="w-full mx-auto grid justify-center xl:grid-cols-7 gap-4 px-4 py-6">
            {/* Left spacer */}
            <div className="hidden xl:block col-span-1" />

            {/* Main content */}
            <div className="col-span-1 xl:col-span-4 max-w-3xl w-full mx-auto">
              <PostContentViewer
                postId={postId}
                highlightCommentId={commentId}
                onPostLoaded={handlePostLoaded}
                isDetailView
              />
            </div>

            {/* Right sidebar — desktop only */}
            <div className="hidden xl:block col-span-2">
              <PostDetailSidebar
                authorId={postMeta?.authorId || null}
                taggedEntities={postMeta?.taggedEntities || []}
                loading={!loadComplete}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>

      {/* Hidden composer to listen for open-create-post-dialog events */}
      {user && (
        <div className="hidden">
          <SmartComposerButton />
        </div>
      )}
    </div>
  );
};

export default PostView;
