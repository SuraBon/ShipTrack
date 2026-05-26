import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface Props  { children: ReactNode; }
interface State  { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.error('Unhandled application error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[85vh] p-4 bg-slate-50">
          <div className="flex flex-col items-center w-full max-w-md p-6 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-black text-slate-900 font-display">เกิดข้อผิดพลาดในการทำงาน</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              ระบบตรวจพบข้อผิดพลาดบางอย่างระหว่างรัน หากปัญหายังคงอยู่กรุณาลองรีโหลดหน้าเว็บ หรือติดต่อผู้ดูแลระบบ
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 p-3.5 w-full rounded-xl bg-slate-50 border border-slate-200 overflow-auto text-left max-h-40">
                <pre className="text-[10px] font-mono text-slate-600 whitespace-pre-wrap leading-normal">
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="mt-6 flex w-full gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-900 text-white text-xs font-black shadow-sm hover:bg-slate-800 transition-all active:scale-[0.99]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                รีโหลดหน้า
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all active:scale-[0.99]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                ลองใหม่อีกครั้ง
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
