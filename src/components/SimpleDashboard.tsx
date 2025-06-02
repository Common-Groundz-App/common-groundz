
import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const SimpleDashboard = () => {
  const { user } = useAuth();

  // Redirect to landing if not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome to your personalized dashboard
        </p>
        
        <div className="space-y-4">
          <p className="text-green-600">Welcome, {user.email}!</p>
          <p className="text-sm text-gray-500">User ID: {user.id}</p>
          
          <div className="flex gap-4 justify-center">
            <Link 
              to="/home" 
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Feed
            </Link>
            <Link 
              to="/" 
              className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Landing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleDashboard;
