
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const SimpleLandingPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome to Groundz
        </h1>
        <p className="text-muted-foreground">
          Discover, recommend, and connect with your community
        </p>
        
        {user ? (
          <div className="space-y-4">
            <p className="text-green-600">Welcome back, {user.email}!</p>
            <Link 
              to="/home" 
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">Join the community today</p>
            <Link 
              to="/auth" 
              className="inline-block px-6 py-3 bg-brand-orange text-white rounded-lg hover:bg-brand-orange/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleLandingPage;
