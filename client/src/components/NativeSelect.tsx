/**
 * NativeSelect — custom dropdown that works inside Radix Dialog.
 * Renders the list via createPortal at z-[9999] with pointer-events: auto
 * so Radix's body pointer-events:none doesn't block clicks.
 * Supports an "อื่นๆ" option that reveals a custom text input.
 */

import { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Pencil } from 'lucide-react';

export const OTHER_VALUE = '__OTHER__';

interface NativeSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  icon?: string;
  disabled?: boolean;
  className?: string;
  otherLabel?: string;
  otherPlaceholder?: string;
  allowOther?: boolean;
}

export default function NativeSelect({
  value,
  onChange,
  options,
  placeholder = 'เลือก...',
  icon,
  disabled = false,
  className = '',
  otherLabel = 'อื่นๆ (ระบุเอง)',
  otherPlaceholder = 'ระบุเอง...',
  allowOther = true,
}: NativeSelectProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [filterText, setFilterText] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const isCustom = value !== '' && value !== OTHER_VALUE && !options.includes(value);
  const showCustomInput = value === OTHER_VALUE || isCustom;

  // Label shown in the trigger button
  const displayLabel = (() => {
    if (!value) return null;
    if (value === OTHER_VALUE) return otherLabel;
    if (isCustom) return value; // show the typed custom text
    return value;
  })();

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
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [open, updateRect]);

  // Focus search input when dropdown opens, and reset filter on close
  useEffect(() => {
    if (open) {
      setTimeout(() => filterInputRef.current?.focus(), 50);
    } else {
      setFilterText('');
    }
  }, [open]);

  // Focus custom input when it appears
  useEffect(() => {
    if (showCustomInput) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [showCustomInput]);

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 999;
  const dropUp = rect ? spaceBelow < 260 : false;

  const listStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        pointerEvents: 'auto',
        ...(dropUp
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      }
    : { display: 'none' };

  // Filter options based on filterText
  const filteredOptions = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return options;
    return options.filter(opt => opt.toLowerCase().includes(query));
  }, [options, filterText]);

  const allOptions = [
    ...filteredOptions,
    ...(allowOther ? [OTHER_VALUE] : []),
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Trigger button */}
      <button
        ref={btnRef}
        id={inputId}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={[
          'w-full flex items-center gap-2.5 h-12 rounded-2xl border px-3 text-sm font-display text-left transition-all outline-none',
          open
            ? 'border-primary ring-2 ring-primary/15 bg-white'
            : 'border-outline-variant bg-white hover:border-primary/40',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          displayLabel ? 'text-on-surface' : 'text-on-surface-variant/50',
        ].join(' ')}
      >
        {icon && (
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant/40 shrink-0">
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">
          {displayLabel ?? placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-on-surface-variant/45 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {/* Dropdown list — portalled to body, pointer-events: auto overrides Radix */}
      {open && rect && createPortal(
        <div
          ref={listRef}
          style={listStyle}
          className="rounded-2xl border border-outline-variant/20 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Search box */}
          <div className="border-b border-outline-variant/10 p-2 bg-slate-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-on-surface-variant/45">
                search
              </span>
              <input
                ref={filterInputRef}
                type="text"
                placeholder="ค้นหา..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                  }
                }}
                className="w-full h-8 rounded-lg border border-outline-variant/30 bg-white pl-8 pr-7 text-xs outline-none focus:border-primary transition-all font-display"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-lg text-on-surface-variant/40 hover:bg-slate-200"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1.5">
            {allOptions.map(opt => {
              const isOther = opt === OTHER_VALUE;
              const label = isOther ? otherLabel : opt;
              const isSelected = isOther
                ? value === OTHER_VALUE || isCustom
                : value === opt;

              return (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={e => {
                    // Use mousedown so it fires before the blur/close handler
                    e.preventDefault();
                    onChange(isOther ? OTHER_VALUE : opt);
                    setOpen(false);
                  }}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-display text-left transition-colors',
                    isSelected
                      ? 'bg-primary/8 text-primary font-bold'
                      : 'text-on-surface hover:bg-surface-container-lowest',
                    isOther ? 'border-t border-outline-variant/10 mt-1 pt-3' : '',
                  ].join(' ')}
                >
                  {isOther && (
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/50" aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate">{label}</span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-4 py-3 text-xs font-semibold text-muted-foreground text-center font-display">ไม่พบข้อมูล</p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Custom text input */}
      {showCustomInput && (
        <div className="relative animate-in slide-in-from-top-1 duration-200">
          <Pencil className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 select-none text-primary/50" aria-hidden="true" />
          <input
            ref={customInputRef}
            type="text"
            value={isCustom ? value : ''}
            onChange={e => onChange(e.target.value || OTHER_VALUE)}
            disabled={disabled}
            placeholder={otherPlaceholder}
            maxLength={100}
            className="w-full h-12 rounded-2xl border border-primary/30 bg-primary/[0.03] pl-9 pr-4 text-sm font-display outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Resolves the final value from a NativeSelect before submitting:
 * - OTHER_VALUE (nothing typed yet) → ''
 * - anything else → value as-is
 */
export function resolveSelectValue(value: string): string {
  return value === OTHER_VALUE ? '' : value;
}
