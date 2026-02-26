
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import GuestNavBar from '@/components/profile/GuestNavBar';
import Footer from '@/components/Footer';
import RecommendationContentViewer from '@/components/content/RecommendationContentViewer';
import PublicContentNotFound from '@/components/content/PublicContentNotFound';
import SEOHead from '@/components/seo/SEOHead';
import { useAuth } from '@/contexts/AuthContext';

interface RecommendationMeta {
  title: string;
  content: string;
  visibility: string;
  entityName?: string;
}

const RecommendationView = () => {
  const { recommendationId } = useParams<{ recommendationId: string }>();
  const [searchParams] = useSearchParams();
  const commentId = searchParams.get('commentId');
  const { user } = useAuth();

  const [recMeta, setRecMeta] = useState<RecommendationMeta | null>(null);
  const [loadComplete, setLoadComplete] = useState(false);
  const hasTracked = useRef(false);

  // Reset state when route param changes
  useEffect(() => {
    setRecMeta(null);
    setLoadComplete(false);
    hasTracked.current = false;
  }, [recommendationId]);

  const handleRecommendationLoaded = useCallback((meta: RecommendationMeta | null) => {
    setRecMeta(meta);
    setLoadComplete(true);
  }, []);

  // Idempotent guest tracking
  useEffect(() => {
    if (!user && loadComplete && recMeta?.visibility === 'public' && !hasTracked.current) {
      hasTracked.current = true;
      // guest_viewed_recommendation tracking could go here
    }
  }, [user, loadComplete, recMeta]);

  const isPublic = recMeta?.visibility === 'public';

  // Hard 404 for guests viewing non-public content
  if (!recommendationId || (loadComplete && !user && (!recMeta || !isPublic))) {
    return (
      <div className="min-h-screen flex flex-col">
        <GuestNavBar />
        <PublicContentNotFound
          title="Recommendation Not Found"
          description="The requested recommendation could not be found or is not publicly available."
        />
        <Footer />
      </div>
    );
  }

  const seoTitle = recMeta?.title
    ? `${recMeta.title} — Common Groundz`
    : 'Recommendation — Common Groundz';
  const seoDescription = recMeta?.content
    ? recMeta.content.substring(0, 155).replace(/\n/g, ' ')
    : 'View this recommendation on Common Groundz';

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        type="article"
        noindex={!loadComplete || !isPublic}
        canonical={isPublic ? `${window.location.origin}/recommendations/${recommendationId}` : undefined}
      />
      {user ? <NavBarComponent /> : <GuestNavBar />}
      <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
        <RecommendationContentViewer
          recommendationId={recommendationId}
          highlightCommentId={commentId}
          onRecommendationLoaded={handleRecommendationLoaded}
        />
      </div>
      <Footer />
    </div>
  );
};

export default RecommendationView;
