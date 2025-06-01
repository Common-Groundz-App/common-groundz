
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';

const Index = () => {
  const { user, isLoading } = useAuth();

  // Simple memoization to prevent unnecessary re-calculations
  const routingDecision = React.useMemo(() => {
    if (isLoading) {
      return { type: 'loading' };
    }

    if (user) {
      console.log('🔄 [Index] Authenticated user detected, redirecting to /home');
      return { type: 'redirect' };
    }

    console.log('🎨 [Index] Rendering landing page');
    return { type: 'landing' };
  }, [isLoading, user]);

  // Handle routing decisions
  switch (routingDecision.type) {
    case 'loading':
      return <LoadingSpinner size="lg" text="Loading..." className="min-h-screen flex items-center justify-center" />;
    
    case 'redirect':
      return <Navigate to="/home" replace />;
    
    case 'landing':
    default:
      return (
        <div className="min-h-screen">
          <NavBarComponent />
          <main>
            <HeroSection />
            <FeaturesSection />
            <TestimonialsSection />
            <CTASection />
          </main>
          <Footer />
        </div>
      );
  }
};

export default Index;
