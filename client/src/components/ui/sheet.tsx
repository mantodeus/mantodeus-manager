"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X as XIcon } from "@/components/ui/Icon";
import { usePortalRoot } from "@/hooks/usePortalRoot";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  const portalRoot = usePortalRoot();
  return (
    <SheetPrimitive.Portal 
      data-slot="sheet-portal" 
      container={portalRoot}
      {...props} 
    />
  );
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-[var(--blur-standard)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "duration-[var(--dur-standard)] ease-[var(--ease-out)]",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          // Surface styling with soft borders
          "bg-card fixed z-50 flex flex-col gap-4 shadow-xl border-border/50",
          // Respect iOS safe area for PWA sheets
          "pt-[env(safe-area-inset-top)]",
          // Animation base
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "transition-transform ease-[var(--ease-out)]",
          "data-[state=closed]:duration-[var(--dur-standard)] data-[state=open]:duration-[var(--dur-slow)]",
          // Side-specific styling
          // Note: left/right sheets respect bottom tab bar on mobile via --bottom-safe-area
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right top-0 right-0 w-3/4 border-l sm:max-w-sm max-md:bottom-[var(--bottom-safe-area)] md:bottom-0 md:h-full",
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left top-0 left-0 w-3/4 border-r sm:max-w-sm max-md:bottom-[var(--bottom-safe-area)] md:bottom-0 md:h-full",
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t rounded-t-xl",
          className
        )}
        onOpenAutoFocus={(event) => {
          if (isMobile && isStandalone) {
            event.preventDefault();
          }
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          if (isMobile && isStandalone) {
            event.preventDefault();
          }
          onCloseAutoFocus?.(event);
        }}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 rounded-md border border-transparent bg-transparent text-foreground opacity-70 transition-[opacity,background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)] hover:opacity-100 hover:bg-foreground/5 hover:border-border/70 active:bg-foreground/8 dark:hover:bg-foreground/7 dark:active:bg-foreground/10 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
