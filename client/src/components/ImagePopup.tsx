import { useState } from 'react';
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

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setIframeLoaded(false); }}>
      <DialogTrigger asChild>
        {triggerVariant === 'icon' ? (
          <button
            type="button"
            className={`inline-grid h-8 w-8 shrink-0 place-items-center bg-transparent text-primary transition-all hover:text-secondary active:scale-95 ${className}`}
            aria-label={`ดู${title}`}
            title={`ดู${title}`}
          >
            <span className="material-symbols-outlined text-[20px]">photo_library</span>
          </button>
        ) : (
          <button type="button" className={`flex items-center gap-2.5 px-5 py-3 bg-surface-container-low text-primary hover:bg-surface-container rounded-2xl border border-outline-variant/30 font-display font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${className}`}>
            <span className="material-symbols-outlined text-xl">image</span>
            ดู{title}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-5xl max-h-[88vh] flex flex-col p-0 rounded-3xl overflow-hidden border-none bg-transparent shadow-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="bg-transparent p-2 sm:p-3">
          <div className="relative flex h-[62vh] max-h-[680px] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container shadow-sm">
            <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-2xl bg-primary/90 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
              <span className="material-symbols-outlined text-lg text-secondary">photo_camera</span>
              <span className="text-sm font-black">{title}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-2xl bg-white text-primary shadow-lg shadow-black/20 transition-all hover:bg-secondary active:scale-95"
              aria-label="ปิดรูปหลักฐาน"
            >
              <span className="material-symbols-outlined text-2xl font-black">close</span>
            </button>
            {!iframeLoaded && (
              <div className="absolute z-0 flex max-w-xs flex-col items-center justify-center p-8 text-center text-on-surface-variant/30">
                <span className="material-symbols-outlined mb-4 text-6xl animate-pulse">cloud_download</span>
                <p className="font-display text-lg font-bold text-primary/40">กำลังโหลดรูปหลักฐาน...</p>
                <p className="mt-3 text-xs leading-relaxed">กำลังเตรียมรูปจากแหล่งเก็บไฟล์</p>
              </div>
            )}
            {/* We use an iframe to safely preview the Google Drive file inside the dialog */}
            <iframe
              src={iframeUrl}
              className="absolute inset-0 z-10 h-full w-full border-0"
              allow="autoplay"
              title={title}
              onLoad={() => setIframeLoaded(true)}
            />
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
