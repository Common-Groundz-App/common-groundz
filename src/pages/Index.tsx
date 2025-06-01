
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
  const renderCount = React.useRef(0);
  
  // Increment render count for debugging
  renderCount.current++;
  console.log(`📄 [Index] Render #${renderCount.current}`);

  const { user, isLoading } = useAuth();

  console.log(`📄 [Index] Auth state - isLoading: ${isLoading}, hasUser: ${!!user}`);

  // Show loading state
  if (isLoading) {
    console.log('📄 [Index] Showing loading state');
    return (
      <LoadingSpinner 
        size="lg" 
        text="Loading..." 
        className="min-h-screen flex items-center justify-center" 
      />
    );
  }

  // Redirect authenticated users
  if (user) {
    console.log('🔄 [Index] User authenticated, redirecting to /home');
    return <Navigate to="/home" replace />;
  }

  // Show landing page
  console.log('🎨 [Index] Rendering landing page');
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
};

export default Index;
