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
      richColors
      closeButton
      position="top-center"
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
          toast: '!overflow-hidden !scrollbar-none !rounded-xl !border !bg-popover !text-popover-foreground !shadow-lg',
          title: '!text-sm !font-semibold',
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
