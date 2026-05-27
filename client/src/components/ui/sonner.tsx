import { useEffect, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  useEffect(() => {
    const styleId = 'data-sonner-scrollbar-fix';
    if (document.head.querySelector(`style[${styleId}]`)) return;
    const style = document.createElement('style');
    style.setAttribute(styleId, 'true');
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
    document.head.appendChild(style);
  }, []);

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
        } as CSSProperties
      }
      toastOptions={{
        style: {
          overflow: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
        classNames: {
          toast:
            '!min-h-14 !overflow-hidden !scrollbar-none !rounded-2xl !border !border-border !bg-popover !px-4 !py-3 !text-popover-foreground !shadow-lg !shadow-black/10 dark:!shadow-black/40',
          title: '!text-sm !font-semibold !text-popover-foreground',
          description: '!text-xs !text-muted-foreground',
          actionButton: '!rounded-lg !bg-primary !text-primary-foreground',
          cancelButton: '!rounded-lg !bg-muted !text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
