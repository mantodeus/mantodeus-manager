import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "@/components/ui/Icon";
import { useAutoScrollOnOpen } from "@/hooks/useAutoScrollOnOpen";

import { cn } from "@/lib/utils";

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  );
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  // #region agent log - Capture baseline and start compensation IMMEDIATELY on trigger click
  const handleClick = (e: React.MouseEvent) => {
    const appContent = document.querySelector('.app-content') as HTMLElement | null;
    const vv = (window as any).visualViewport;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
    
    // PREVENTION: Lock viewport height IMMEDIATELY when trigger is clicked (before menu opens)
    if (isMobile && isStandalone) {
      const html = document.documentElement;
      const body = document.body;
      const initialVvHeight = vv?.height ?? window.innerHeight;
      const initialScrollTop = appContent?.scrollTop ?? 0;
      
      // Store initial state for restoration (will be restored when menu closes)
      const initialState = {
        bodyHeight: body.style.height,
        bodyMaxHeight: body.style.maxHeight,
        bodyOverflow: body.style.overflow,
        htmlHeight: html.style.height,
        htmlMaxHeight: html.style.maxHeight,
        htmlOverflow: html.style.overflow,
      };
      (window as any).__dropdownInitialState = initialState;
      
      // Lock the viewport height immediately
      const lockHeight = initialVvHeight + 'px';
      html.style.height = lockHeight;
      html.style.maxHeight = lockHeight;
      html.style.overflow = 'hidden';
      body.style.height = lockHeight;
      body.style.maxHeight = lockHeight;
      body.style.overflow = 'hidden';
      
      // Log prevention start
      const logData = {location:'dropdown-menu.tsx:trigger-prevent',message:'Locking viewport height on trigger click',data:{initialVvHeight,lockedHeight:lockHeight,initialScrollTop,isMobile,isStandalone},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'P'};
      console.log('[DEBUG]', logData);
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        logs.push(logData);
        if (logs.length > 100) logs.shift();
        localStorage.setItem('debug-logs', JSON.stringify(logs));
      } catch(e) {}
    }
    
    const logData = {location:'dropdown-menu.tsx:trigger',message:'Dropdown trigger clicked - BEFORE open',data:{isMobile,isStandalone,windowScrollY:window.scrollY,windowInnerHeight:window.innerHeight,visualViewportHeight:vv?.height,visualViewportOffsetTop:vv?.offsetTop,appContentScrollTop:appContent?.scrollTop,bodyOverflow:document.body.style.overflow},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'L'};
    console.log('[DEBUG]', logData);
    try {
      const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
      logs.push(logData);
      if (logs.length > 100) logs.shift();
      localStorage.setItem('debug-logs', JSON.stringify(logs));
    } catch(e) {}
    props.onClick?.(e);
  };
  // #endregion
  
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
      onClick={handleClick}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Watch for open state changes via data-state attribute
  // Also watch for when element is added to DOM (for portal-rendered menus)
  React.useEffect(() => {
    const checkState = () => {
      if (menuRef.current) {
        const state = menuRef.current.getAttribute('data-state');
        const wasOpen = isOpen;
        const nowOpen = state === 'open';
        
        // #region agent log - Always log state checks to see what's happening
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
        const appContent = document.querySelector('.app-content') as HTMLElement | null;
        const vv = (window as any).visualViewport;
        if (nowOpen !== wasOpen || state) { // Log even if state didn't change, to see current state
          const logData = {location:'dropdown-menu.tsx:checkState',message:nowOpen !== wasOpen ? 'Dropdown state CHANGED' : 'Dropdown state check',data:{wasOpen,nowOpen,currentState:state,isMobile,isStandalone,windowScrollY:window.scrollY,windowInnerHeight:window.innerHeight,visualViewportHeight:vv?.height,visualViewportOffsetTop:vv?.offsetTop,appContentScrollTop:appContent?.scrollTop,bodyOverflow:document.body.style.overflow},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'};
          console.log('[DEBUG]', logData);
          try {
            const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
            logs.push(logData);
            if (logs.length > 100) logs.shift();
            localStorage.setItem('debug-logs', JSON.stringify(logs));
          } catch(e) {}
          fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch((e)=>console.warn('[DEBUG] Fetch failed:', e));
        }
        // #endregion
        
        setIsOpen(nowOpen);
      }
    };

    if (!menuRef.current) {
      // If ref not ready, check again after a short delay
      const timeout = setTimeout(() => {
        if (menuRef.current) {
          checkState();
        }
      }, 0);
      return () => clearTimeout(timeout);
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
          checkState();
        }
        // Also watch for when element is added to DOM
        if (mutation.type === 'childList') {
          checkState();
        }
      });
    });

    observer.observe(menuRef.current, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: false,
      subtree: false,
    });

    // Also observe the document body for portal-rendered menus
    const bodyObserver = new MutationObserver(() => {
      if (menuRef.current) {
        checkState();
      }
    });

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: false,
    });

    // Initial check
    checkState();

    // Also check periodically as a fallback (less frequent to avoid performance issues)
    const pollInterval = setInterval(checkState, 100);

    return () => {
      observer.disconnect();
      bodyObserver.disconnect();
      clearInterval(pollInterval);
    };
  }, []);

  // Avoid auto-scroll on mobile to prevent layout jumps when opening menus.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);
  useAutoScrollOnOpen({
    isOpen,
    menuRef,
    enabled: !isMobile,
    scrollBuffer: isMobile ? 32 : 16, // Increased buffer on mobile for better tab bar clearance
  });
  
  // #region agent log
  React.useEffect(() => {
    if (!isOpen) return;
    const checkScroll = () => {
      const appContent = document.querySelector('.app-content') as HTMLElement | null;
      const menuRect = menuRef.current?.getBoundingClientRect();
      const logData = {location:'dropdown-menu.tsx:119',message:'Menu open scroll check',data:{isOpen,windowScrollY:window.scrollY,windowInnerHeight:window.innerHeight,appContentScrollTop:appContent?.scrollTop,menuTop:menuRect?.top,menuBottom:menuRect?.bottom,bodyOverflow:document.body.style.overflow},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'};
      console.log('[DEBUG]', logData);
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        logs.push(logData);
        if (logs.length > 100) logs.shift();
        localStorage.setItem('debug-logs', JSON.stringify(logs));
      } catch(e) {}
      fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch((e)=>console.warn('[DEBUG] Fetch failed:', e));
    };
    const timeout = setTimeout(checkScroll, 50);
    const timeout2 = setTimeout(checkScroll, 150);
    const timeout3 = setTimeout(checkScroll, 300);
    return () => { clearTimeout(timeout); clearTimeout(timeout2); clearTimeout(timeout3); };
  }, [isOpen]);
  // #endregion

  // #region agent log - PREVENT iOS PWA viewport height change when menu opens (no compensation)
  React.useEffect(() => {
    if (!isOpen || !isMobile || !isStandalone) return;
    
    // PREVENTION STRATEGY: Lock the viewport height to prevent iOS from adjusting it
    const vv = (window as any).visualViewport;
    const html = document.documentElement;
    const body = document.body;
    const appContent = document.querySelector('.app-content') as HTMLElement | null;
    
    // Capture current viewport height BEFORE it changes
    const initialVvHeight = vv?.height ?? window.innerHeight;
    const initialBodyHeight = body.style.height;
    const initialHtmlHeight = html.style.height;
    const initialBodyOverflow = body.style.overflow;
    const initialHtmlOverflow = html.style.overflow;
    const initialScrollTop = appContent?.scrollTop ?? 0;
    
    // Lock the viewport height by setting fixed heights on html/body
    // This prevents iOS from recalculating the viewport when the menu opens
    const lockHeight = initialVvHeight + 'px';
    html.style.height = lockHeight;
    html.style.maxHeight = lockHeight;
    html.style.overflow = 'hidden';
    body.style.height = lockHeight;
    body.style.maxHeight = lockHeight;
    body.style.overflow = 'hidden';
    // Don't set position: fixed on body as that causes scroll position reset
    
    // Monitor to ensure viewport doesn't change and maintain scroll position
    let rafId: number;
    let checkCount = 0;
    const maxChecks = 60; // Monitor for ~1 second
    
    const monitor = () => {
      if (!isOpen || checkCount >= maxChecks) {
        if (rafId) cancelAnimationFrame(rafId);
        return;
      }
      checkCount++;
      
      const currentVv = (window as any).visualViewport;
      const currentVvHeight = currentVv?.height ?? window.innerHeight;
      const vvHeightDelta = currentVvHeight - initialVvHeight;
      
      // If viewport tries to change, force it back
      if (Math.abs(vvHeightDelta) > 2) {
        // Re-apply the lock
        html.style.height = lockHeight;
        html.style.maxHeight = lockHeight;
        body.style.height = lockHeight;
        body.style.maxHeight = lockHeight;
        
        // Log the prevention attempt (only first few times to avoid spam)
        if (checkCount <= 5) {
          const logData = {location:'dropdown-menu.tsx:prevent-viewport-change',message:'Preventing viewport height change',data:{vvHeightDelta,initialVvHeight,currentVvHeight,lockedHeight:lockHeight},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'P'};
          console.log('[DEBUG]', logData);
          try {
            const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
            logs.push(logData);
            if (logs.length > 100) logs.shift();
            localStorage.setItem('debug-logs', JSON.stringify(logs));
          } catch(e) {}
        }
      }
      
      // Also maintain scroll position
      if (appContent && Math.abs((appContent.scrollTop ?? 0) - initialScrollTop) > 2) {
        appContent.scrollTop = initialScrollTop;
      }
      
      rafId = requestAnimationFrame(monitor);
    };
    
    // Start monitoring immediately
    rafId = requestAnimationFrame(monitor);
    
    // Log that prevention is active
    const logDataStart = {location:'dropdown-menu.tsx:prevent-start',message:'Locking viewport height to prevent jump',data:{initialVvHeight,lockedHeight:lockHeight,initialScrollTop},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'P'};
    console.log('[DEBUG]', logDataStart);
    try {
      const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
      logs.push(logDataStart);
      if (logs.length > 100) logs.shift();
      localStorage.setItem('debug-logs', JSON.stringify(logs));
    } catch(e) {}
    
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      
      // Restore original styles (use stored initial state from trigger click if available)
      const storedState = (window as any).__dropdownInitialState;
      if (storedState) {
        html.style.height = storedState.htmlHeight;
        html.style.maxHeight = storedState.htmlMaxHeight || '';
        html.style.overflow = storedState.htmlOverflow;
        body.style.height = storedState.bodyHeight;
        body.style.maxHeight = storedState.bodyMaxHeight || '';
        body.style.overflow = storedState.bodyOverflow;
        delete (window as any).__dropdownInitialState;
      } else {
        // Fallback to captured values
        html.style.height = initialHtmlHeight;
        html.style.maxHeight = '';
        html.style.overflow = initialHtmlOverflow;
        body.style.height = initialBodyHeight;
        body.style.maxHeight = '';
        body.style.overflow = initialBodyOverflow;
      }
      
      // Log cleanup
      const logDataEnd = {location:'dropdown-menu.tsx:prevent-end',message:'Viewport height lock released',data:{checkCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'P'};
      console.log('[DEBUG]', logDataEnd);
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        logs.push(logDataEnd);
        if (logs.length > 100) logs.shift();
        localStorage.setItem('debug-logs', JSON.stringify(logs));
      } catch(e) {}
    };
  }, [isOpen, isMobile, isStandalone]);
  // #endregion

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={menuRef}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        onOpenAutoFocus={(event) => {
          // #region agent log
          const appContent = document.querySelector('.app-content') as HTMLElement | null;
          const logData1 = {location:'dropdown-menu.tsx:126',message:'onOpenAutoFocus called',data:{isMobile,isStandalone,windowScrollY:window.scrollY,windowInnerHeight:window.innerHeight,appContentScrollTop:appContent?.scrollTop,bodyOverflow:document.body.style.overflow,defaultPrevented:event.defaultPrevented},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'};
          console.log('[DEBUG]', logData1);
          try {
            const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
            logs.push(logData1);
            if (logs.length > 100) logs.shift();
            localStorage.setItem('debug-logs', JSON.stringify(logs));
          } catch(e) {}
          fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData1)}).catch((e)=>console.warn('[DEBUG] Fetch failed:', e));
          // #endregion
          if (isMobile && isStandalone) {
            event.preventDefault();
            // #region agent log
            const logData2 = {location:'dropdown-menu.tsx:132',message:'onOpenAutoFocus prevented',data:{isMobile,isStandalone},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'};
            console.log('[DEBUG]', logData2);
            try {
              const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
              logs.push(logData2);
              if (logs.length > 100) logs.shift();
              localStorage.setItem('debug-logs', JSON.stringify(logs));
            } catch(e) {}
            fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch((e)=>console.warn('[DEBUG] Fetch failed:', e));
            // #endregion
          }
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          if (isMobile && isStandalone) {
            event.preventDefault();
          }
          onCloseAutoFocus?.(event);
        }}
        className={cn(
          "glass-context-menu text-popover-foreground z-[140] max-h-(--radix-dropdown-menu-content-available-height) origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "glass-menu-item data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "glass-menu-item relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "glass-menu-item relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "glass-menu-item [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "glass-panel text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-xl p-2",
        className
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
