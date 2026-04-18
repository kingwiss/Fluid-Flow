// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-brand-dark text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-4xl text-red-500">⚠️</span>
          </div>
          <h1 className="text-2xl font-serif mb-4">Something went wrong.</h1>
          <p className="text-white/50 mb-8 max-w-sm">We've encountered an unexpected issue. Your session is safe, please click below to resume.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-brand-gold text-brand-dark rounded-xl font-medium"
          >
            Return to Checkout
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
