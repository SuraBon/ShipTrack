import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

function Spinner({
  className,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  ...props
}: React.ComponentProps<"svg">) {
  const hasAccessibleName = Boolean(ariaLabel || role);

  return (
    <Loader2Icon
      role={role ?? (ariaLabel ? "status" : undefined)}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden ?? (hasAccessibleName ? undefined : true)}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
