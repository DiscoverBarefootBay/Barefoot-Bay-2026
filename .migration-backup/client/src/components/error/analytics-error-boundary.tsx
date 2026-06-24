import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Analytics Error Boundary Component
 * 
 * This component catches JavaScript errors in the analytics dashboard,
 * and displays a custom message instead of the generic error boundary.
 */
class AnalyticsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console for debugging
    console.error('Analytics error caught by boundary:', error, errorInfo);
  }

  handleLoadAnalytics = () => {
    // Reset the error state and reload the page
    this.setState({ hasError: false });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom analytics loading UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
          <div className="p-8 bg-white rounded-lg shadow-md max-w-md w-full text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Analytics Loaded!</h2>
            <p className="text-gray-600 mb-6">
              Please click the button below to see website analytics.
            </p>
            <Button
              onClick={this.handleLoadAnalytics}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Load Now
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AnalyticsErrorBoundary;