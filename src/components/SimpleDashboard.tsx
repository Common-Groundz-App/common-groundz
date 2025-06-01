
import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const SimpleDashboard = () => {
  const { user } = useAuth();

  console.log('📊 [SimpleDashboard] Rendering - user:', user ? 'authenticated' : 'not authenticated');

  // Redirect to landing if not authenticated
  if (!user) {
    console.log('🔀 [SimpleDashboard] No user, redirecting to /');
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">
          🏠 Simple Dashboard
        </h1>
        <p className="text-muted-foreground">
          Protected route - only visible to authenticated users
        </p>
        
        <div className="space-y-4">
          <p className="text-green-600">✅ Welcome, {user.email}!</p>
          <p className="text-sm text-gray-500">User ID: {user.id}</p>
          
          <Link 
            to="/" 
            className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Landing
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SimpleDashboard;
