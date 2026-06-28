import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. When omitted, a compact in-card message is shown. */
  fallback?: ReactNode;
  /** Min height of the default fallback so the card keeps its shape. */
  minHeight?: number;
}

interface State {
  hasError: boolean;
}

/**
 * ChartErrorBoundary
 *
 * Localized error boundary for individual chart cards. If a chart subtree throws
 * (e.g. a render-time failure in the charting library), only that card shows a
 * graceful fallback instead of the failure bubbling up to the global
 * ErrorBoundary and collapsing the entire page.
 */
class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Chart failed to render (contained by ChartErrorBoundary):', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex items-center justify-center text-center text-muted-foreground text-sm px-4"
          style={{ minHeight: this.props.minHeight ?? 300 }}
        >
          This chart couldn&apos;t be displayed. The rest of the dashboard is still available.
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChartErrorBoundary;
