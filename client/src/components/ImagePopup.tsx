import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ImagePopupProps {
  url: string;
  title?: string;
  className?: string;
  triggerVariant?: 'button' | 'icon';
}

export default function ImagePopup({ url, title = 'รูปหลักฐาน', className = '', triggerVariant = 'button' }: ImagePopupProps) {
  const [open, setOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  
  // แปลง URL ให้เป็นรูปแบบ preview เพื่อให้แสดงใน iframe ได้
  // ถ้าเป็น base64/data URL ให้ใช้ตรงๆ ไม่ต้อง parse
  let iframeUrl = url;
  if (url && !url.startsWith('data:')) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id) {
        iframeUrl = `https://drive.google.com/file/d/${id}/preview`;
      }
    } catch {
      // Ignore if not a valid URL
    }
  }

  useEffect(() => {
    if (!open || iframeLoaded || previewFailed) return;
    const timer = window.setTimeout(() => setPreviewFailed(true), 12000);
    return () => window.clearTimeout(timer);
  }, [iframeLoaded, open, previewFailed]);

  const resetPreviewState = () => {
    setIframeLoaded(false);
    setPreviewFailed(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetPreviewState(); }}>
      <DialogTrigger asChild>
        {triggerVariant === 'icon' ? (
          <button
            type="button"
            className={`inline-grid h-8 w-8 shrink-0 place-items-center bg-transparent text-primary transition-all hover:text-secondary active:scale-95 ${className}`}
            aria-label={`ดู${title}`}
            title={`ดู${title}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">photo_library</span>
          </button>
        ) : (
          <button type="button" className={`flex items-center gap-2.5 px-5 py-3 bg-surface-container-low text-primary hover:bg-surface-container rounded-2xl border border-outline-variant/30 font-display font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${className}`}>
            <span className="material-symbols-outlined text-xl" aria-hidden="true">image</span>
            ดู{title}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-h-[88vh] overflow-hidden rounded-[1.5rem] border border-gray-100 bg-white p-0 shadow-xl sm:max-w-5xl" showCloseButton={false}>
        <div className="flex max-h-[88vh] flex-col">
          <div className="relative bg-slate-950 px-5 py-5 text-white">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-20 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="ปิดรูปหลักฐาน"
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
            </button>
            <DialogTitle className="pr-12 font-display text-xl font-black leading-tight text-white">{title}</DialogTitle>
            <p className="mt-1 text-xs font-semibold text-slate-300">กดปิดเพื่อกลับไปยังรายการ</p>
          </div>
          <div className="bg-white p-4">
          <div className="relative flex h-[62vh] max-h-[680px] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-slate-50 shadow-sm">
            {!iframeLoaded && !previewFailed && (
              <div className="absolute z-0 flex max-w-xs flex-col items-center justify-center p-8 text-center text-on-surface-variant/30">
                <span className="material-symbols-outlined mb-4 text-6xl animate-pulse" aria-hidden="true">cloud_download</span>
                <p className="font-display text-lg font-bold text-slate-400">กำลังโหลดรูปหลักฐาน...</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">กำลังเตรียมรูปจากแหล่งเก็บไฟล์</p>
              </div>
            )}
            {previewFailed && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
                <span className="material-symbols-outlined mb-4 text-5xl text-slate-300" aria-hidden="true">broken_image</span>
                <p className="font-display text-lg font-black text-slate-800">ไม่สามารถแสดงตัวอย่างรูปได้</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                  ลิงก์รูปอาจหมดอายุ ถูกจำกัดสิทธิ์ หรือแหล่งเก็บไฟล์ไม่ตอบสนอง
                </p>
                {url && !url.startsWith('data:') && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    เปิดลิงก์ต้นทาง
                  </a>
                )}
              </div>
            )}
            {/* We use an iframe to safely preview the Google Drive file inside the dialog */}
            <iframe
              src={iframeUrl}
              className={`absolute inset-0 z-10 h-full w-full border-0 ${previewFailed ? 'hidden' : ''}`}
              allow="autoplay"
              title={title}
              onLoad={() => { setIframeLoaded(true); setPreviewFailed(false); }}
              onError={() => setPreviewFailed(true)}
            />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
