import React from 'react';
import { Users, Star, Book, Film } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
const FeaturesSection = () => {
  return <section id="features" className="py-16 md:py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Use Common Groundz?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover recommendations from people you actually know and trust, not algorithms or strangers.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard icon={<Users className="h-10 w-10 text-primary" />} title="Trust Your Circle" description="Get recommendations only from people you know and trust - friends, family, and colleagues." />
          
          <FeatureCard icon={<Star className="h-10 w-10 text-primary" />} title="Personalized For You" description="Build your network of trusted recommenders based on shared interests and tastes." />
          
          <FeatureCard icon={<Book className="h-10 w-10 text-primary" />} title="All In One Place" description="From books to beauty products, movies to music - all recommendations in a single app." />
          
          <FeatureCard icon={<Film className="h-10 w-10 text-primary" />} title="Movie Night Made Easy" description="Never struggle to decide what to watch - see what your friends love first." />
          
          <FeatureCard icon={<Users className="h-10 w-10 text-primary" />} title="Build Your Profile" description="Share your own favorites and become a trusted recommender in your circle." />
          
          <FeatureCard icon={<Star className="h-10 w-10 text-primary" />} title="Discover New Favorites" description="Expand your horizons with trusted recommendations for things you might have missed." />
        </div>
      </div>
    </section>;
};
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}
const FeatureCard = ({
  icon,
  title,
  description
}: FeatureCardProps) => {
  return <Card className="border-none shadow-sm card-hover">
      <CardContent className="p-6">
        <div className="mb-4">{icon}</div>
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>;
};
export default FeaturesSection;