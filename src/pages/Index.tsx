
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

  // Show loading state
  if (isLoading) {
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
    return <Navigate to="/home" replace />;
  }

  // Show landing page
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
