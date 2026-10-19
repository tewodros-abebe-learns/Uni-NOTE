import 'katex/dist/katex.min.css';
import { setupPwa, offerPwaUpdate } from './lib/pwa';
import { initializeMediaVault } from './utils/mediaStore';
import { reportStorageFailure } from './lib/localPersistence';
import React, { StrictMode, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

setupPwa();
// Updates are offered explicitly, never forced over an active editor.
const updateSW = registerSW({ onNeedRefresh() { offerPwaUpdate(() => updateSW(true)); } });

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.removeItem('uninote_reading_state');
      localStorage.removeItem('uninote_cached_local_note');
    } catch {}
    window.location.href = window.location.pathname;
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#131314] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-[#1c1d22] border border-white/10 rounded-3xl p-8 shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Something went wrong</h1>
              <p className="text-xs text-white/50 leading-relaxed">
                An unexpected interface issue occurred. Reloading may lose changes that could not be saved. Export a backup when possible.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[11px] text-amber-300/80 bg-black/40 p-3 rounded-xl overflow-x-auto text-left font-mono max-h-32 no-scrollbar">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 rounded-xl bg-white text-black font-semibold text-xs transition-all hover:bg-white/90 active:scale-[0.98] cursor-pointer"
              >
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-medium transition-all cursor-pointer"
              >
                Reset to Main Vault
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

async function bootstrap() {
  try { await initializeMediaVault(); }
  catch { reportStorageFailure('Legacy image migration could not complete. The original data was kept; no notes or images were pruned.'); }
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>
);

}
void bootstrap();
