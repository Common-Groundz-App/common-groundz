
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const SimpleLandingPage = () => {
  const { user } = useAuth();

  console.log('🏠 [SimpleLandingPage] Rendering - user:', user ? 'authenticated' : 'not authenticated');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">
          🧪 Phase 2+3: Simple Landing Page
        </h1>
        <p className="text-muted-foreground">
          Static landing page with minimal logic
        </p>
        
        {user ? (
          <div className="space-y-4">
            <p className="text-green-600">✅ User authenticated: {user.email}</p>
            <Link 
              to="/home" 
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">👋 No user signed in</p>
            <div className="text-sm text-muted-foreground">
              Testing auth state display only
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleLandingPage;
