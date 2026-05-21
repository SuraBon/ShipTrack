/**
 * Status Badge Component
 * แสดงสถานะของพัสดุด้วยสี
 */

import type { ParcelStatus } from '@/types/parcel';

interface StatusBadgeProps {
  status: ParcelStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusStyles = (status: ParcelStatus) => {
    switch (status) {
      case 'รอจัดส่ง':
        return 'border-amber-200 bg-amber-50 text-amber-900';
      case 'กำลังจัดส่ง':
        return 'border-blue-200 bg-blue-50 text-blue-900';
      case 'ส่งสำเร็จ':
        return 'border-emerald-200 bg-emerald-50 text-emerald-900';
      default:
        return 'border-border bg-muted text-muted-foreground';
    }
  };

  const getStatusDot = (status: ParcelStatus) => {
    switch (status) {
      case 'รอจัดส่ง':
        return 'bg-amber-500';
      case 'กำลังจัดส่ง':
        return 'bg-blue-500';
      case 'ส่งสำเร็จ':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <span
      className={`inline-flex h-7 min-w-[108px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-medium leading-none transition-colors ${getStatusStyles(status)} ${className}`}
    >
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(status)} ${status === 'กำลังจัดส่ง' ? 'animate-pulse' : ''}`} />
      <span className="leading-none">{status}</span>
    </span>
  );
}
