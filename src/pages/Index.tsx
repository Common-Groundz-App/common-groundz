
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

  console.log('🏠 Index render:', { 
    isLoading, 
    hasUser: !!user 
  });

  // Show loading state while authentication is being checked
  if (isLoading) {
    console.log('⏳ Showing loading state...');
    return <LoadingSpinner size="lg" text="Loading..." className="min-h-screen flex items-center justify-center" />;
  }

  // Redirect to /home if user is authenticated
  if (user) {
    console.log('🔄 Authenticated user, redirecting to /home');
    return <Navigate to="/home" replace />;
  }

  // Render landing page if user is not authenticated
  console.log('🎨 Rendering landing page');
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
