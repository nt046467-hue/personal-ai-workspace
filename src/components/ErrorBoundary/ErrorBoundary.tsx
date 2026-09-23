import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught component error:', error, errorInfo);
  }

  public handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '320px',
          height: '100%',
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--text-primary)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '16px',
          }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            {this.props.fallbackTitle || 'Something went wrong in this view'}
          </h2>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            maxWidth: '440px',
            lineHeight: 1.5,
            marginBottom: '20px',
          }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
            >
              <Home size={14} />
              <span>Go to Home</span>
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={this.handleReload}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
