import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { usePortalRoot } from "@/hooks/usePortalRoot";
import { cn } from "@/lib/utils";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const portalRoot = usePortalRoot();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  return (
    <PopoverPrimitive.Portal container={portalRoot}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={(event) => {
          if (isMobile && isStandalone) {
            event.preventDefault();
          }
          onOpenAutoFocus?.(event);
        }}
        className={cn(
          // Surface styling with soft borders
          "bg-popover text-popover-foreground z-50 w-72 rounded-xl border border-border/50 p-4 shadow-xl outline-hidden",
          "origin-(--radix-popover-content-transform-origin)",
          // Animation with design system tokens
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          "duration-[var(--dur-quick)] ease-[var(--ease-out)]",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
