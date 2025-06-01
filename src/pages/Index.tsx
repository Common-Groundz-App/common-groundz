
import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import NavBarComponent from '@/components/NavBarComponent';

const Index = () => {
  const { user } = useAuth();

  console.log('🏠 [Index] Rendering - user:', user ? 'authenticated' : 'not authenticated');

  // Simple redirect logic - auth is already initialized by AuthInitializer
  if (user) {
    console.log('🔀 [Index] User authenticated, redirecting to /home');
    return <Navigate to="/home" replace />;
  }

  console.log('📄 [Index] Showing landing page');
  
  // Show landing page for unauthenticated users
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
