import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Add CSS to hide scrollbars
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
      .toaster [data-sonner-toast]::-webkit-scrollbar {
        display: none;
      }
      .toaster [data-sonner-toast] {
        scrollbar-width: none;
        -ms-overflow-style: none;
        overflow: hidden !important;
      }
      .toaster [data-sonner-toast] [data-close-button] {
        display: none !important;
      }
    `;
    if (!document.head.querySelector('style[data-sonner-scrollbar-fix]')) {
      style.setAttribute('data-sonner-scrollbar-fix', 'true');
      document.head.appendChild(style);
    }
  }

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={false}
      position="top-center"
      offset={{ top: 72, left: 16, right: 16 }}
      mobileOffset={{ top: 72, left: 12, right: 12 }}
      duration={3600}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          overflow: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
        classNames: {
          toast: '!min-h-14 !overflow-hidden !scrollbar-none !rounded-2xl !border !border-gray-100 !bg-white !px-4 !py-3 !text-slate-900 !shadow-lg !shadow-slate-900/10',
          title: '!text-sm !font-semibold',
          description: '!text-xs !text-slate-500',
          actionButton: '!rounded-lg !bg-primary !text-primary-foreground',
          cancelButton: '!rounded-lg !bg-muted !text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
