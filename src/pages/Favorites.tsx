
import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const Favorites = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 pt-24 pb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-6">Favorites</h1>
        <p className="text-lg text-muted-foreground mb-8">
          View and manage your favorite recommendations.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder content */}
          <div className="border rounded-lg p-6 shadow-sm">
            <h3 className="font-semibold text-xl mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Your favorites will be available soon.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Favorites;
