import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FilterX, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getAuditLogs, type AuditLogRow } from '@/lib/parcelService';
import { useDebounce } from '@/hooks/useDebounce';
import { AUDIT_ACTION_LABELS, translateAuditDetails } from '@/lib/translationUtils';

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  '',
  'CREATE_PARCEL',
  'CONFIRM_RECEIPT',
  'START_DELIVERY',
  'RELEASE_DELIVERY',
  'CREATE_USER',
  'UPDATE_USER',
  'DISABLE_USER',
  'DELETE_USER',
  'CREATE_BRANCH',
  'DELETE_BRANCH',
  'DELETE_PARCEL',
  'EDIT_PARCEL',
  'UPDATE_PROFILE',
  'LOGIN_BLOCKED',
];

function AuditLogCard({ log }: { log: AuditLogRow }) {
  return (
    <div className="app-compact-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-foreground">{AUDIT_ACTION_LABELS[log.action] || log.action || '-'}</p>
          <p className="mt-1 text-xs text-muted-foreground">{log.timestamp || '-'}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {log.actorId || '-'}
        </span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-[0.8fr_1.2fr]">
        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">เป้าหมาย</p>
          <p className="mt-1 break-all font-mono text-xs font-semibold text-foreground">{log.targetId || '-'}</p>
        </div>
        <div className="min-w-0 rounded-xl bg-gray-50 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">รายละเอียด</p>
            <p className="mt-1 break-words text-xs font-medium text-foreground">{translateAuditDetails(log.details) || '-'}</p>
        </div>
      </div>
    </div>
  );
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const debouncedActorId = useDebounce(actorId, 300);
  const debouncedTargetId = useDebounce(targetId, 300);

  const offset = useMemo(() => (page - 1) * PAGE_SIZE, [page]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = Boolean(debouncedQuery || action || debouncedActorId || debouncedTargetId);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const res = await getAuditLogs({
      limit: PAGE_SIZE,
      offset,
      query: debouncedQuery,
      action,
      actorId: debouncedActorId,
      targetId: debouncedTargetId,
    });
    if (res.success) {
      setLogs(res.logs ?? []);
      setTotalCount(res.totalCount ?? 0);
      setHasMore(Boolean(res.hasMore));
    } else {
      toast.error(res.error || 'ไม่สามารถโหลด Log ระบบได้');
      setLogs([]);
      setTotalCount(0);
      setHasMore(false);
    }
    setLoading(false);
  }, [action, debouncedActorId, debouncedQuery, debouncedTargetId, offset]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, action, debouncedActorId, debouncedTargetId]);

  const clearFilters = () => {
    setQuery('');
    setAction('');
    setActorId('');
    setTargetId('');
  };

  return (
    <div className="app-page animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="app-page-header">
        <div className="flex items-center gap-4">
          <div className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white md:flex">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="app-page-title">Log ระบบ</h1>
            <p className="app-page-subtitle">ตรวจสอบว่าใครทำอะไร เมื่อไร และเกี่ยวข้องกับรายการหรือผู้ใช้ใด</p>
          </div>
        </div>
        <button type="button" onClick={fetchLogs} disabled={loading} className="app-secondary-button h-10 px-3">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      <div className="app-toolbar grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาการกระทำ เป้าหมาย หรือรายละเอียด..." className="app-input w-full pl-10" />
        </div>
        <select value={action} onChange={event => setAction(event.target.value)} className="app-input w-full">
          {ACTION_OPTIONS.map(option => <option key={option || 'ALL'} value={option}>{option ? (AUDIT_ACTION_LABELS[option] || option) : 'ทุกการกระทำ'}</option>)}
        </select>
        <input value={actorId} onChange={event => setActorId(event.target.value)} placeholder="รหัสผู้กระทำ" className="app-input w-full" />
        <input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder="รหัสเป้าหมาย" className="app-input w-full" />
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="app-secondary-button h-11 px-3 text-xs text-red-600">
            <FilterX className="h-4 w-4" aria-hidden="true" />
            ล้าง
          </button>
        )}
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {totalCount} รายการ
          </div>
          <span className="text-xs text-muted-foreground">หน้า {page}/{totalPages}</span>
        </div>

        {loading ? (
          <div className="grid place-items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            กำลังโหลด...
          </div>
        ) : logs.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center text-sm text-muted-foreground">
            <ClipboardList className="h-10 w-10 opacity-30" aria-hidden="true" />
            ไม่พบ Log ระบบ
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
              {logs.map((log, index) => <AuditLogCard key={`${log.timestamp}-${log.actorId}-${log.action}-${log.targetId}-${index}`} log={log} />)}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-outline-variant/10 bg-surface-container-lowest/50 px-4 py-3">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page === 1 || loading} className="app-secondary-button h-9 px-3 text-xs">ก่อนหน้า</button>
              <span className="text-xs font-semibold text-muted-foreground">
                แสดง {offset + 1}-{Math.min(offset + logs.length, totalCount)} จาก {totalCount}
              </span>
              <button type="button" onClick={() => setPage(value => value + 1)} disabled={!hasMore || loading} className="app-secondary-button h-9 px-3 text-xs">ถัดไป</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
