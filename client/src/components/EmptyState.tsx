import { type ReactNode } from 'react';

export type EmptyStateTone = 'default' | 'amber' | 'emerald' | 'blue';

export interface EmptyStateProps {
  icon: string | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: EmptyStateTone;
}

const toneMap: Record<EmptyStateTone, { shell: string; iconBg: string; title: string }> = {
  default: {
    shell: 'border-outline-variant/20 bg-white',
    iconBg: 'bg-primary/8 text-primary',
    title: 'text-primary',
  },
  amber: {
    shell: 'border-amber-100 bg-amber-50/60',
    iconBg: 'bg-white text-amber-700 shadow-sm',
    title: 'text-amber-800',
  },
  emerald: {
    shell: 'border-emerald-100 bg-emerald-50/70',
    iconBg: 'bg-white text-emerald-700 shadow-sm',
    title: 'text-emerald-800',
  },
  blue: {
    shell: 'border-blue-100 bg-blue-50/70',
    iconBg: 'bg-white text-blue-700 shadow-sm',
    title: 'text-blue-800',
  },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'default',
}: EmptyStateProps) {
  const styles = toneMap[tone];
  return (
    <div className={`flex flex-col items-center gap-3.5 rounded-3xl border px-5 py-9 text-center shadow-xs transition-all ${styles.shell}`}>
      <div className={`grid h-14 w-14 place-items-center rounded-2xl ${styles.iconBg}`}>
        {typeof icon === 'string' ? (
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">{icon}</span>
        ) : (
          icon
        )}
      </div>
      <div className="max-w-xs">
        <p className={`font-display text-base font-black ${styles.title}`}>{title}</p>
        {description && <p className="mt-1 text-xs font-semibold leading-relaxed text-on-surface-variant/65">{description}</p>}
      </div>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
