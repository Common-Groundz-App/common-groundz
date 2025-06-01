
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
  const [renderCount, setRenderCount] = React.useState(0);
  const [lastAction, setLastAction] = React.useState('initial');

  // Track renders
  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
  });

  // Track state changes over time
  React.useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [${timestamp}] Index state change:`, { 
      renderCount,
      isLoading, 
      hasUser: !!user,
      userId: user?.id || 'none',
      userEmail: user?.email || 'none'
    });
  }, [isLoading, user, renderCount]);

  // Log every render with timestamp
  const timestamp = new Date().toISOString();
  console.log(`🏠 [${timestamp}] Index render #${renderCount}:`, { 
    isLoading, 
    hasUser: !!user,
    action: 'rendering'
  });

  // Show loading state while authentication is being checked
  if (isLoading) {
    const action = 'showing-loading';
    if (lastAction !== action) {
      console.log(`⏳ [${timestamp}] Loading state active - render #${renderCount}`);
      setLastAction(action);
    }
    return <LoadingSpinner size="lg" text="Loading..." className="min-h-screen flex items-center justify-center" />;
  }

  // Redirect to /home if user is authenticated
  if (user) {
    const action = 'redirecting-to-home';
    if (lastAction !== action) {
      console.log(`🔄 [${timestamp}] Authenticated user detected, redirecting to /home - render #${renderCount}`, {
        userId: user.id,
        email: user.email
      });
      setLastAction(action);
    }
    return <Navigate to="/home" replace />;
  }

  // Render landing page if user is not authenticated
  const action = 'rendering-landing-page';
  if (lastAction !== action) {
    console.log(`🎨 [${timestamp}] Rendering landing page - render #${renderCount}`);
    setLastAction(action);
  }

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
