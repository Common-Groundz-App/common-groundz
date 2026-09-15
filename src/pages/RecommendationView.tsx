
import NavBarComponent from '@/components/NavBarComponent';
import GuestNavBar from '@/components/profile/GuestNavBar';
import Footer from '@/components/Footer';
import PublicContentNotFound from '@/components/content/PublicContentNotFound';
import SEOHead from '@/components/seo/SEOHead';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Phase 4.3 tombstone — the legacy recommendations layer is frozen.
 * This route stays alive until Gate 5 so historical notification links
 * degrade to a controlled "not available" state instead of a broken page.
 * No legacy tables are read here.
 */
const RecommendationView = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="Recommendation — Common Groundz"
        description="This content is no longer available on Common Groundz"
        noindex={true}
      />
      {user ? <NavBarComponent /> : <GuestNavBar />}
      <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
        <PublicContentNotFound
          title="Recommendation No Longer Available"
          description="This recommendation is no longer available. Discover trusted experiences and reviews on Common Groundz instead."
        />
      </div>
      {!user && <Footer />}
    </div>
  );
};

export default RecommendationView;
