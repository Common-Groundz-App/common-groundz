
import React from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AuthContextBoundaryState {
  hasError: boolean;
  retryCount: number;
}

class AuthContextBoundary extends React.Component<
  { children: React.ReactNode },
  AuthContextBoundaryState
> {
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): AuthContextBoundaryState {
    console.error('🚨 [AuthContextBoundary] Caught auth context error:', error);
    
    // Check if it's the specific auth context error
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      return { hasError: true, retryCount: 0 };
    }
    
    // For other errors, don't handle them here
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [AuthContextBoundary] Auth context error details:', error, errorInfo);
    
    // Only handle auth context errors
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      // Auto-retry after a short delay
      if (this.state.retryCount < 3) {
        this.retryTimer = setTimeout(() => {
          console.log('🔄 [AuthContextBoundary] Retrying auth context initialization...');
          this.setState(prevState => ({
            hasError: false,
            retryCount: prevState.retryCount + 1
          }));
        }, 100 * (this.state.retryCount + 1)); // Exponential backoff
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount >= 3) {
        // If we've retried too many times, show an error
        return (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
              <p className="text-gray-600 mb-4">Unable to initialize authentication system</p>
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

      // Show loading while retrying
      return (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" text="Initializing authentication..." />
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthContextBoundary;
