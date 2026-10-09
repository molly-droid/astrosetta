import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initNative } from '@/lib/native.jsx'
import { supabase } from '@/api/shim/supabase.js'

// ── Global error monitoring ─────────────────────────────────────────────────
// Catches unhandled runtime errors and React render errors, sends them to the
// ErrorLog entity via the logFrontendError backend function.

function reportError(errorData) {
  try {
    const isErr = errorData instanceof Error;
    supabase.functions.invoke('log-frontend-error', {
      body: {
        error_message: isErr ? errorData.message : (errorData.message || String(errorData)),
        stack_trace: isErr ? errorData.stack : (errorData.stack || ''),
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        component_stack: errorData.componentStack || '',
      },
    }).catch(() => {});
  } catch {}
}

// Uncaught runtime errors (promise rejections, uncaught exceptions)
window.addEventListener('error', (e) => {
  reportError(e.error || { message: e.message });
});
window.addEventListener('unhandledrejection', (e) => {
  reportError(e.reason instanceof Error ? e.reason : { message: String(e.reason) });
});

// React render errors via error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    reportError({ message: error?.message || String(error), stack: error?.stack || '', componentStack: errorInfo.componentStack || '' });
  }
  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.error?.stack || this.state.componentStack || '';
      return React.createElement('div', {
        style: {
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#07101e', color: '#C9A961', fontFamily: 'Georgia, serif',
          flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '24px',
        },
      },
        React.createElement('div', { style: { fontSize: '32px' } }, '✦'),
        React.createElement('p', { style: { fontSize: '16px' } }, 'Something went wrong.'),
        React.createElement('p', { style: { fontSize: '12px', color: '#e07070', maxWidth: '600px', wordBreak: 'break-word', fontFamily: 'monospace' } }, msg),
        stack ? React.createElement('pre', { style: { fontSize: '10px', color: '#9aa6bd', maxWidth: '700px', maxHeight: '240px', overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap', fontFamily: 'monospace' } }, stack) : null,
        React.createElement('button', {
          onClick: () => window.location.reload(),
          style: {
            marginTop: '8px', padding: '8px 20px', borderRadius: '999px',
            background: '#C9A961', color: '#1a2436', border: 'none', cursor: 'pointer',
            fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: 'bold',
          },
        }, 'Refresh'),
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

// Native (Capacitor) chrome: status bar + splash hide. No-op on the web.
initNative();
