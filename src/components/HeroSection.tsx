
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const HeroSection = () => {
  const { user, isLoading } = useAuth();

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-brand-orange/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
      <div className="container px-4 mx-auto text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            Discover Your Next
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-orange to-orange-500">
              Favorite Thing
            </span>
          </h1>
          
          {/* Subheading */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Get personalized recommendations from people you trust. Share what you love and discover amazing new experiences.
          </p>
          
          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mb-10 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-orange" />
              <span>Trusted by thousands</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-brand-orange" />
              <span>5-star experiences</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-orange" />
              <span>Instant recommendations</span>
            </div>
          </div>
          
          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isLoading && !user ? (
              <>
                <Button 
                  size="lg" 
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  asChild
                >
                  <Link to="/auth?tab=signup" className="flex items-center gap-2">
                    Get Started Free
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  className="px-8 py-3 rounded-full text-lg border-2 hover:bg-accent"
                  asChild
                >
                  <Link to="/auth?tab=signin">
                    Sign In
                  </Link>
                </Button>
              </>
            ) : user ? (
              <Button 
                size="lg" 
                className="bg-brand-orange hover:bg-brand-orange/90 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                asChild
              >
                <Link to="/home" className="flex items-center gap-2">
                  Go to Feed
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-6 h-6 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>
          
          {/* Additional info */}
          <p className="text-sm text-muted-foreground mt-8">
            No credit card required • Free forever • Start exploring in seconds
          </p>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
