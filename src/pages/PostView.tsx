
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import GuestNavBar from '@/components/profile/GuestNavBar';
import Footer from '@/components/Footer';
import PostContentViewer from '@/components/content/PostContentViewer';
import PublicContentNotFound from '@/components/content/PublicContentNotFound';
import SEOHead from '@/components/seo/SEOHead';
import { useAuth } from '@/contexts/AuthContext';

interface PostMeta {
  title: string;
  content: string;
  visibility: string;
}

const PostView = () => {
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const commentId = searchParams.get('commentId');
  const { user } = useAuth();

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
      // guest_viewed_post tracking could go here
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

  // SEO: conservative noindex while loading, switch when confirmed public
  const seoTitle = postMeta?.title ? `${postMeta.title} — Common Groundz` : 'Post — Common Groundz';
  const seoDescription = postMeta?.content
    ? postMeta.content.substring(0, 155).replace(/\n/g, ' ')
    : 'View this post on Common Groundz';

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        type="article"
        noindex={!loadComplete || !isPublic}
        canonical={isPublic ? `${window.location.origin}/post/${postId}` : undefined}
      />
      {user ? <NavBarComponent /> : <GuestNavBar />}
      <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
        <PostContentViewer
          postId={postId}
          highlightCommentId={commentId}
          onPostLoaded={handlePostLoaded}
        />
      </div>
      <Footer />
    </div>
  );
};

export default PostView;
