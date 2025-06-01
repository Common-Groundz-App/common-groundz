
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface AuthErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AuthErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AuthErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    console.error('❌ Auth Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ Auth Error Boundary details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <Card className="w-full max-w-md p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
            <p className="text-muted-foreground mb-4">
              Something went wrong with the authentication system.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Reload Page
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;
