import React from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Local error boundary around the ChartWheel SVG.
 * A render crash in the wheel should NOT take down the whole MyChart page
 * (placement readings, Big 3, tabs are independent). This boundary isolates
 * the crash, logs the real error so it can be diagnosed, and renders a small
 * fallback so the rest of the page keeps working.
 */
export default class ChartWheelBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const errMsg = error?.message || String(error);
    try {
      base44.entities.ErrorLog.create({
        error_message: `[ChartWheel] ${errMsg}`,
        stack_trace: error?.stack || '',
        component_stack: info?.componentStack || '',
        page_url: typeof window !== 'undefined' ? window.location.href : '',
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });
    } catch (_e) {
      /* swallow — never crash the boundary itself */
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
          <div className="text-2xl text-gold-accent">✦</div>
          <p className="font-body text-xs text-brass leading-relaxed max-w-xs">
            The chart wheel couldn't render just now. Your placements and readings are still available below.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="font-body text-[10px] text-gold-accent underline hover:text-gold-primary transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}