
import React from 'react';
import { Button } from '@/components/ui/button';

const CTASection = () => {
  return (
    <section className="py-16 md:py-24 bg-primary/5">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to discover recommendations<br className="hidden md:block" /> from people you trust?</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Join thousands of users who have transformed how they discover new favorites on Common Groundz.
        </p>
        <Button size="lg" className="px-8">Get Started for Free</Button>
      </div>
    </section>
  );
};

export default CTASection;
