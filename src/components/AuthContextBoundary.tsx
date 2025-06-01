
import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthContextBoundaryState {
  hasError: boolean;
}

class AuthContextBoundary extends React.Component<
  { children: React.ReactNode },
  AuthContextBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AuthContextBoundaryState {
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      return { hasError: true };
    }
    
    // For other errors, don't handle them here
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      console.error('🚨 [AuthContextBoundary] Auth context error:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
            <p className="text-gray-600 mb-4">Unable to initialize authentication</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthContextBoundary;
