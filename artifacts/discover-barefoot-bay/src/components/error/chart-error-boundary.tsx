import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. When omitted, a compact in-card message is shown. */
  fallback?: ReactNode;
  /** Min height of the default fallback so the card keeps its shape. */
  minHeight?: number;
  /**
   * When any value in this array changes, the boundary clears its error state and
   * re-attempts rendering its children. Use it to key the boundary on the inputs
   * that drive the chart (e.g. selected time range, journey type, bot filter) so a
   * transient render failure recovers automatically when the user changes a filter
   * instead of requiring a full page reload.
   */
  resetKeys?: ReadonlyArray<unknown>;
}

interface State {
  hasError: boolean;
}

function resetKeysChanged(
  prev: ReadonlyArray<unknown> | undefined,
  next: ReadonlyArray<unknown> | undefined,
): boolean {
  if (prev === next) return false;
  if (!prev || !next) return prev !== next;
  if (prev.length !== next.length) return true;
  return prev.some((value, index) => !Object.is(value, next[index]));
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

  componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && resetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false });
    }
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
