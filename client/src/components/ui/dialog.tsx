import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X as XIcon } from "@/components/ui/Icon";
import * as React from "react";

// Context to track composition state across dialog children
const DialogCompositionContext = React.createContext<{
  isComposing: () => boolean;
  setComposing: (composing: boolean) => void;
  justEndedComposing: () => boolean;
  markCompositionEnd: () => void;
}>({
  isComposing: () => false,
  setComposing: () => {},
  justEndedComposing: () => false,
  markCompositionEnd: () => {},
});

export const useDialogComposition = () =>
  React.useContext(DialogCompositionContext);

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const composingRef = React.useRef(false);
  const justEndedRef = React.useRef(false);
  const endTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // #region agent log
  React.useEffect(() => {
    if (!props.open) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    const logData = {
      location: 'dialog.tsx:Dialog:open',
      message: 'Dialog opening - checking body/app-content state',
      data: {
        bodyPosition: document.body.style.position,
        bodyOverflow: document.body.style.overflow,
        bodyTop: document.body.style.top,
        bodyWidth: document.body.style.width,
        windowScrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        appContent: (() => {
          const el = document.querySelector('.app-content') as HTMLElement | null;
          return el ? {
            scrollTop: el.scrollTop,
            overflowY: el.style.overflowY,
            overflow: el.style.overflow,
          } : null;
        })(),
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'A',
    };
    console.log('[DEBUG] Dialog opening:', logData);
    fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch((e)=>console.error('[DEBUG] Log fetch failed:', e));
  }, [props.open]);
  // #endregion

  const contextValue = React.useMemo(
    () => ({
      isComposing: () => composingRef.current,
      setComposing: (composing: boolean) => {
        composingRef.current = composing;
      },
      justEndedComposing: () => justEndedRef.current,
      markCompositionEnd: () => {
        justEndedRef.current = true;
        if (endTimerRef.current) {
          clearTimeout(endTimerRef.current);
        }
        endTimerRef.current = setTimeout(() => {
          justEndedRef.current = false;
        }, 150);
      },
    }),
    []
  );

  return (
    <DialogCompositionContext.Provider value={contextValue}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogCompositionContext.Provider>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
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

DialogOverlay.displayName = "DialogOverlay";

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onEscapeKeyDown,
  onOpenAutoFocus,
  zIndex,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  zIndex?: number;
}) {
  const { isComposing } = useDialogComposition();

  // #region agent log
  React.useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    const checkState = () => {
      const logData = {
        location: 'dialog.tsx:DialogContent:state-change',
        message: 'DialogContent mounted/updated - checking body/app-content state',
        data: {
          bodyPosition: document.body.style.position,
          bodyOverflow: document.body.style.overflow,
          bodyTop: document.body.style.top,
          bodyWidth: document.body.style.width,
          windowScrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          appContent: (() => {
            const el = document.querySelector('.app-content') as HTMLElement | null;
            return el ? {
              scrollTop: el.scrollTop,
              overflowY: el.style.overflowY,
              overflow: el.style.overflow,
            } : null;
          })(),
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B',
      };
      console.log('[DEBUG] DialogContent state:', logData);
      fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch((e)=>console.error('[DEBUG] Log fetch failed:', e));
    };
    
    // Check immediately and after a short delay (Radix applies styles asynchronously)
    checkState();
    const timeout = setTimeout(checkState, 100);
    return () => clearTimeout(timeout);
  });
  // #endregion

  const handleEscapeKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      // Check both the native isComposing property and our context state
      // This handles Safari's timing issues with composition events
      const isCurrentlyComposing = (e as any).isComposing || isComposing();

      // If IME is composing, prevent dialog from closing
      if (isCurrentlyComposing) {
        e.preventDefault();
        return;
      }

      // Call user's onEscapeKeyDown if provided
      onEscapeKeyDown?.(e);
    },
    [isComposing, onEscapeKeyDown]
  );

  const handleOpenAutoFocus = React.useCallback(
    (event: Event) => {
      event.preventDefault();
      onOpenAutoFocus?.(event);
    },
    [onOpenAutoFocus]
  );

  const zIndexValue = zIndex ?? 50;

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay 
        style={{ zIndex: zIndexValue }}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          // Surface and layout
          "bg-card fixed grid w-full gap-4 rounded-xl border border-border/50 p-6 shadow-xl outline-none focus:outline-none",
          // Animation
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "duration-[var(--dur-standard)] ease-[var(--ease-out)]",
          !zIndex && "z-50",
          // Default: centered dialog (desktop)
          "top-[50%] left-[50%] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 sm:max-w-lg",
          // Mobile: top-aligned with safe margins
          "max-md:top-4 max-md:left-1/2 max-md:-translate-x-1/2 max-md:translate-y-0 max-md:max-h-[calc(100vh-var(--bottom-safe-area,0px)-2rem)] max-md:mb-[calc(var(--bottom-safe-area,0px)+1rem)]",
          // Allow full-screen override via className
          className
        )}
        onEscapeKeyDown={handleEscapeKeyDown}
        onOpenAutoFocus={handleOpenAutoFocus}
        style={{ zIndex: zIndexValue }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-md border border-transparent bg-transparent text-foreground opacity-70 transition-[opacity,background-color,border-color] duration-[var(--dur-quick)] ease-[var(--ease-out)] hover:opacity-100 hover:bg-foreground/5 hover:border-border/70 active:bg-foreground/8 dark:hover:bg-foreground/7 dark:active:bg-foreground/10 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
};

