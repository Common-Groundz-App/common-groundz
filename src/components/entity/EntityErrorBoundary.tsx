import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface EntityErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  slug?: string;
}

interface EntityErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class EntityErrorBoundary extends React.Component<
  EntityErrorBoundaryProps,
  EntityErrorBoundaryState
> {
  constructor(props: EntityErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): EntityErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 EntityErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
              <p className="text-muted-foreground mb-4">
                {this.props.slug 
                  ? `Error loading entity "${this.props.slug}". The entity might have a changed URL.`
                  : 'There was an error loading this entity.'
                }
              </p>
              <div className="space-x-2">
                {this.props.slug && (
                  <Button 
                    onClick={() => window.location.href = `/entity/${this.props.slug}?v=1`}
                  >
                    Try Version 1
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}