import React, { useState } from 'react';
import {
  type OfflineQueueItem,
  removeOfflineAction,
  resetFailedOfflineActions,
  resetOfflineActionForRetry,
} from '@/lib/offlineQueue';
import { syncOfflineQueue } from '@/lib/parcelService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, AlertTriangle, Loader2, Package, RefreshCw, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface OfflineQueueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  queue: OfflineQueueItem[];
}

export function OfflineQueueDialog({ isOpen, onClose, queue }: OfflineQueueDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAll = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncOfflineQueue();
    } catch {
      toast.error('เกิดข้อผิดพลาดระหว่างการซิงค์ข้อมูล');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    const count = await resetFailedOfflineActions();
    if (count === 0) {
      toast.info('ไม่มีรายการจัดส่งที่ล้มเหลวให้ทดลองส่งใหม่');
      return;
    }
    toast.info(`ตั้งค่ารายการจำนวน ${count} รายการเพื่อลองซิงค์ใหม่อีกครั้ง`);
    await handleSyncAll();
  };

  const handleRetryItem = async (id: string) => {
    const ok = await resetOfflineActionForRetry(id);
    if (!ok) return;
    await handleSyncAll();
  };

  const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('คุณต้องการลบรายการนี้ออกจากคิวออฟไลน์หรือไม่? การดำเนินการนี้จะทำให้ข้อมูลสูญหายและไม่ถูกบันทึกเข้าระบบ')) {
      try {
        await removeOfflineAction(id);
        toast.success('ลบรายการออกจากคิวออฟไลน์เรียบร้อยแล้ว');
      } catch {
        toast.error('ไม่สามารถลบรายการออกจากคิวออฟไลน์ได้');
      }
    }
  };

  const getActionName = (action: string) => {
    switch (action) {
      case 'createParcel':
        return 'สร้างรายการพัสดุใหม่';
      case 'confirmReceipt':
        return 'ยืนยันการจัดส่งพัสดุ';
      case 'startDelivery':
        return 'เริ่มจัดส่งพัสดุ';
      case 'releaseDelivery':
        return 'คืนงานจัดส่ง';
      default:
        return action;
    }
  };

  const getItemMetadata = (item: OfflineQueueItem) => {
    const payload = item.payload || {};
    if (item.action === 'createParcel') {
      return `จาก: ${payload.senderBranch || '-'} ➜ ถึง: ${payload.receiverBranch || '-'}`;
    }
    return `เลขพัสดุ: ${payload.trackingID || payload.trackingId || '-'}`;
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    } catch {
      return '';
    }
  };

  const failedItems = queue.filter(item => item.status === 'failed');
  const pendingItems = queue.filter(item => item.status === 'pending');
  const syncingItems = queue.filter(item => item.status === 'syncing');

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md rounded-2xl border border-outline-variant bg-white p-6 shadow-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2 font-display text-lg font-black text-primary">
            <span className="material-symbols-outlined text-amber-500">sync_problem</span>
            รายการรอซิงค์ออฟไลน์ ({queue.length})
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            รายการจัดส่งพัสดุที่ถูกบันทึกไว้ในขณะที่ไม่มีสัญญาณอินเทอร์เน็ต ระบบจะทำข้อมูลขึ้นคลาวด์อัตโนมัติเมื่อตรวจพบสัญญาณเน็ต
          </DialogDescription>
        </DialogHeader>

        {failedItems.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
            <div>
              <span className="font-bold">มีรายการที่ซิงค์ไม่สำเร็จ!</span> กรุณาตรวจสอบเหตุผลด้านล่าง หากมีข้อผิดพลาดถาวร (เช่น รหัสผ่านผิด) ท่านสามารถลบรายการออกเพื่อกรอกใหม่ได้
            </div>
          </div>
        )}

        <div className="mt-2 max-h-[320px] overflow-y-auto pr-1 divide-y divide-outline-variant/10">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
              <Package className="h-10 w-10 text-slate-300 stroke-[1.5]" />
              <p className="mt-2 text-xs font-semibold">ไม่มีรายการค้างในคิวออฟไลน์</p>
            </div>
          ) : (
            queue.map(item => (
              <div key={item.id} className="group flex items-start gap-3 py-3 text-xs first:pt-1 last:pb-1">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  item.action === 'createParcel' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {item.action === 'createParcel' ? <Package className="h-4.5 w-4.5" /> : <Truck className="h-4.5 w-4.5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 truncate">{getActionName(item.action)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 font-medium text-slate-500 font-mono text-[10px] truncate">
                    {getItemMetadata(item)}
                  </p>

                  {/* Status Badges */}
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {item.status === 'pending' && (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                        รอซิงค์
                      </span>
                    )}
                    {item.status === 'syncing' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        กำลังซิงค์...
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        ซิงค์ล้มเหลว
                      </span>
                    )}
                  </div>

                  {/* Failed Error Message */}
                  {item.status === 'failed' && item.lastError && (
                    <div className="mt-2 rounded-lg bg-red-50/70 p-2 font-body text-[10px] leading-relaxed text-red-800 border border-red-100/50">
                      <span className="font-bold">สาเหตุ:</span> {item.lastError}
                    </div>
                  )}
                  {item.status === 'pending' && item.nextRetryAt && item.nextRetryAt > Date.now() && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      จะลองซิงค์อีกครั้งโดยอัตโนมัติ
                    </p>
                  )}
                </div>

                {item.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => handleRetryItem(item.id)}
                    disabled={isSyncing}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    aria-label="ลองซิงค์ใหม่"
                    title="ลองซิงค์ใหม่"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={e => handleDeleteItem(item.id, e)}
                  disabled={isSyncing || item.status === 'syncing'}
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                  aria-label="ลบรายการ"
                  title="ลบรายการออกจากคิวออฟไลน์"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="app-secondary-button flex-1 rounded-xl text-xs h-10"
            disabled={isSyncing}
          >
            ปิด
          </button>
          {failedItems.length > 0 && (
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={isSyncing}
              className="app-secondary-button flex-1 rounded-xl text-xs h-10 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              ลองรายการที่ล้มเหลว
            </button>
          )}
          {queue.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing || syncingItems.length > 0}
              className="app-primary-button flex-1 rounded-xl text-xs h-10 gap-1.5"
            >
              {isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลเดี๋ยวนี้'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
