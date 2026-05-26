import { cn } from '@/lib/utils';
import { Component, type ReactNode } from 'react';

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
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8 text-center">
            <span className="material-symbols-outlined text-5xl text-error mb-6" aria-hidden="true">error</span>
            <h2 className="text-xl font-bold text-primary mb-4">เกิดข้อผิดพลาดที่ไม่คาดคิด</h2>

            {import.meta.env.DEV && this.state.error && (
              <div className="p-4 w-full rounded-xl bg-surface-container overflow-auto mb-6 text-left">
                <pre className="text-xs text-on-surface-variant whitespace-pre-wrap">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            {!import.meta.env.DEV && (
              <p className="text-sm text-on-surface-variant mb-6">
                ระบบขัดข้องชั่วคราว กรุณารีเฟรชหน้าอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ
              </p>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl',
                'bg-primary text-white font-bold',
                'hover:opacity-90 transition-opacity',
              )}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">refresh</span>
              รีโหลดหน้า
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
