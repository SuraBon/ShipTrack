/**
 * SelectDropdown — unified custom dropdown used across the app.
 * Uses a portal-style fixed position to escape overflow:hidden parents.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  icon?: string;
  disabled?: boolean;
  className?: string;
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  icon,
  disabled = false,
  className = '',
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updateRect = useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    updateRect();
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        listRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const onScroll = () => { updateRect(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, updateRect]);

  const selected = options.find(o => o.value === value);

  // Decide whether to open up or down based on available space
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 999;
  const dropUp = rect ? spaceBelow < 220 : false;

  const listStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        ...(dropUp
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      }
    : { display: 'none' };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={`
          w-full flex items-center gap-2 bg-white border rounded-lg px-3 py-2.5 text-sm text-left
          transition-all outline-none
          ${open ? 'border-primary ring-1 ring-primary' : 'border-outline-variant'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-surface-container-lowest' : 'cursor-pointer hover:border-primary/50'}
          ${selected ? 'text-on-surface font-display' : 'text-on-surface-variant/50 font-display'}
        `}
      >
        {icon && (
          <span className="material-symbols-outlined text-lg text-on-surface-variant/40 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <span className={`material-symbols-outlined text-lg text-on-surface-variant/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          expand_more
        </span>
      </button>

      {open && rect && createPortal(
        <div
          ref={listRef}
          style={listStyle}
          className="bg-white rounded-xl border border-outline-variant/30 shadow-2xl overflow-hidden"
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`
                  w-full flex items-center gap-2 px-4 py-2.5 text-sm font-display text-left transition-colors
                  ${value === opt.value
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-on-surface hover:bg-surface-container-lowest'}
                `}
              >
                <span className="flex-1 truncate">{opt.label}</span>
                {value === opt.value && (
                  <span
                    className="material-symbols-outlined text-[16px] text-primary shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                   aria-hidden="true">
                    check
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
