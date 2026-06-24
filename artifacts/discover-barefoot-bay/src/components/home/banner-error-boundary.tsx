import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BannerMediaFallback } from './banner-media-fallback';

interface Props {
  children: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Banner Error Boundary
 * 
 * This component catches errors that occur in its child components,
 * specifically designed for banner media components to prevent the entire
 * application from crashing when banner media fails to load.
 */
export class BannerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Don't treat video autoplay restrictions as critical errors
    if (error.message?.includes('user didn\'t interact') || 
        error.message?.includes('play() request was interrupted') ||
        error.name === 'NotAllowedError') {
      console.log('Banner video autoplay blocked - this is normal browser behavior');
      // Reset the error state since this isn't actually an error
      this.setState({
        hasError: false,
        error: null
      });
      return;
    }
    
    // You can log the error to an error reporting service
    console.error('Banner error caught by boundary:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, className = '' } = this.props;

    if (hasError) {
      // Render fallback UI
      return (
        <BannerMediaFallback
          error={error?.message || 'An error occurred displaying the banner'}
          className={className}
          onRetry={this.resetError}
        />
      );
    }

    // If no error, render children normally
    return children;
  }
}

export default BannerErrorBoundary;