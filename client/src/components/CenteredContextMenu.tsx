/**
 * CenteredContextMenu Component
 * 
 * Apple-style context menu anchored to the pressed item.
 * 
 * Interaction Model:
 * - Mobile: Long-press (550ms) opens menu, single tap = primary action
 * - Desktop: Right-click opens menu, single click = primary action
 * - No three-dot button (removed for cleaner UI)
 * 
 * Animation: Transform-only
 * Z-index: Active item > Menu > Overlay > Background
 */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLongPress } from "@/hooks/useLongPress";
import { cn } from "@/lib/utils";
import { Edit, Trash2, Copy, CheckCircle2, Archive, RotateCcw, Eye, DollarSign, XCircle, Send, CurrencyEuro } from "@/components/ui/Icon";
import { usePortalRoot } from "@/hooks/usePortalRoot";

export type CenteredContextMenuAction =
  | "edit"
  | "duplicate"
  | "select"
  | "archive"
  | "delete"
  | "restore"
  | "deletePermanently"
  | "view"
  | "markAsSent"
  | "markAsPaid"
  | "markAsInOrder"
  | "void"
  | "revertToDraft"
  | "revertToSent"
  | "markAsCancelled"
  | "markAsNotCancelled";

interface CenteredContextMenuProps {
  /** Callback when an action is selected */
  onAction: (action: CenteredContextMenuAction) => void;
  /** Available actions to show in the menu */
  actions?: CenteredContextMenuAction[];
  /** Callback when the menu opens or closes */
  onOpenChange?: (open: boolean) => void;
  /** The item element to wrap */
  children: React.ReactElement;
  /** Whether the menu is disabled */
  disabled?: boolean;
  /** Custom className for the menu container */
  menuClassName?: string;
}

const actionConfig: Record<
  CenteredContextMenuAction,
  { icon: React.ComponentType<{ className?: string }>; label: string; variant: "default" | "destructive" }
> = {
  view: { icon: Eye, label: "View", variant: "default" },
  edit: { icon: Edit, label: "Edit", variant: "default" },
  delete: { icon: Trash2, label: "Delete", variant: "destructive" },
  duplicate: { icon: Copy, label: "Duplicate", variant: "default" },
  select: { icon: CheckCircle2, label: "Select", variant: "default" },
  archive: { icon: Archive, label: "Archive", variant: "default" },
  restore: { icon: RotateCcw, label: "Restore", variant: "default" },
  deletePermanently: { icon: Trash2, label: "Delete permanently", variant: "destructive" },
  revertToDraft: { icon: RotateCcw, label: "Revert to draft", variant: "destructive" },
  revertToSent: { icon: RotateCcw, label: "Mark as not paid", variant: "destructive" },
  markAsSent: { icon: Send, label: "Mark as sent", variant: "default" },
  markAsPaid: { icon: CurrencyEuro, label: "Mark as paid", variant: "default" },
  markAsCancelled: { icon: XCircle, label: "Mark as cancelled", variant: "destructive" },
  markAsNotCancelled: { icon: RotateCcw, label: "Mark as not cancelled", variant: "default" },
  markAsInOrder: { icon: CheckCircle2, label: "Mark as In Order", variant: "default" },
  void: { icon: XCircle, label: "Void", variant: "destructive" },
};

// STRICT ORDER - This order must never change
const STANDARD_ACTION_ORDER: CenteredContextMenuAction[] = [
  "edit",
  "duplicate",
  "select",
  "archive",
  "delete",
];
const RUBBISH_ACTION_ORDER: CenteredContextMenuAction[] = ["restore", "deletePermanently"];

function getBottomObstructionHeight(): number {
  const tabBar = document.querySelector(".bottom-tab-bar") as HTMLElement | null;
  if (tabBar) {
    const rect = tabBar.getBoundingClientRect();
    const height = window.innerHeight - rect.top;
    return Math.max(height, rect.height || 0);
  }

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    const isPWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const padding = isPWA ? 20 : 8;
    const safeArea = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("env(safe-area-inset-bottom)") || "0"
    );
    return 56 + padding + safeArea;
  }

  return 0;
}

export const CenteredContextMenu = React.forwardRef<
  { open: (event?: PointerEvent | TouchEvent | React.MouseEvent) => void },
  CenteredContextMenuProps
>(({
  onAction,
  actions = ["edit", "delete"],
  onOpenChange,
  children,
  disabled = false,
  menuClassName,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [isTouchHoldActive, setIsTouchHoldActive] = useState(false);
  const [itemRect, setItemRect] = useState<DOMRect | null>(null);
  const [menuHeight, setMenuHeight] = useState(200);
  const menuOpenTimeRef = useRef(0);
  const itemRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blockingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActionTimeRef = useRef(0);
  const portalRoot = usePortalRoot();

  const menuShiftY = useMemo(() => {
    if (!itemRect || !itemRef.current) return 0;

    const viewportHeight = window.innerHeight;
    const spacing = 12;
    const edgePadding = 12;
    const bottomObstruction = getBottomObstructionHeight();
    const isMobile = window.innerWidth < 768;

    // Calculate available space below the item (accounting for tab bar)
    const availableBelow =
      viewportHeight - bottomObstruction - itemRect.bottom - spacing - edgePadding;
    
    // Calculate how much we need to shift to show the FULL menu
    const requiredShift = Math.max(0, menuHeight - availableBelow);
    if (requiredShift <= 0) return 0;

    // Maximum shift is limited by available space above (can go all the way to top)
    const maxShift = Math.max(0, itemRect.top - edgePadding);
    
    // Find parent and siblings for snapping logic
    const parent = itemRef.current.parentElement;
    if (!parent) {
      // No parent - shift as much as needed, up to max
      return Math.min(requiredShift, maxShift);
    }

    const cardSelector =
      '[data-slot="card"], .card, [data-item], li, .item-card, [class*="Card"], [role="article"], article';
    const siblings = Array.from(parent.querySelectorAll(cardSelector))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);
    const currentLeft = itemRect.left;
    const sameColumn = siblings
      .map((node) => ({ node, rect: node.getBoundingClientRect() }))
      .filter(({ rect }) => Math.abs(rect.left - currentLeft) < rect.width / 2)
      .sort((a, b) => a.rect.top - b.rect.top);

    const currentIndex = sameColumn.findIndex(({ node }) => node === itemRef.current);
    const prevRect = currentIndex > 0 ? sameColumn[currentIndex - 1].rect : null;
    
    // Calculate step size (distance to previous item, or default spacing)
    const step = prevRect ? itemRect.top - prevRect.top : itemRect.height + spacing;
    const safeStep = step > 0 ? step : itemRect.height + spacing;
    
    // Calculate how many steps we need to shift to show the full menu
    // Always round UP to ensure full menu is visible
    const stepsNeeded = Math.ceil(requiredShift / safeStep);
    const snappedShift = stepsNeeded * safeStep;

    // Return the snapped shift, but ensure it's at least enough to show the full menu
    // Cap at maxShift (can go all the way to top if needed)
    return Math.min(Math.max(snappedShift, requiredShift), maxShift);
  }, [itemRect, menuHeight]);

  // Calculate menu position (always below the pressed item)
  const menuStyle = useMemo(() => {
    if (!itemRect) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 240; // Approximate menu width
    const spacing = 12;
    const edgePadding = 12;
    const bottomObstruction = getBottomObstructionHeight();

    const centeredLeft = itemRect.left + itemRect.width / 2;
    const left = Math.min(
      Math.max(centeredLeft, edgePadding + menuWidth / 2),
      viewportWidth - edgePadding - menuWidth / 2
    );

    // Calculate menu position after item shift
    const adjustedBottom = itemRect.bottom - menuShiftY;
    const menuTop = adjustedBottom + spacing;
    
    // Calculate available space below the menu (accounting for tab bar)
    const availableBelow =
      viewportHeight - bottomObstruction - menuTop - edgePadding;
    
    // Ensure menu height doesn't exceed available space
    // But prioritize showing the full menu - if we shifted, we should have space
    const maxHeight = Math.max(120, Math.min(menuHeight, availableBelow));

    return {
      position: "fixed" as const,
      top: `${menuTop}px`,
      left: `${left}px`,
      transform: "translateX(-50%)",
      zIndex: 9998,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: `${maxHeight}px`,
      width: "auto",
    };
  }, [itemRect, menuHeight, menuShiftY]);

  const openMenu = useCallback((event?: PointerEvent | TouchEvent | React.MouseEvent) => {
    if (disabled) return;

    // Find the item element
    const findItemElement = (): HTMLElement | null => {
      // First, try to find from the event target
      if (event) {
        const target = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
        if (target) {
          // Look for parent card/item - this is the most reliable method
          const parent = target.closest(
            '[data-item], [data-slot="card"], .card, li, .item-card, [class*="Card"], [role="article"], article'
          );
          if (parent && parent instanceof HTMLElement) {
            return parent;
          }
          
          // Try going up the DOM tree
          let current: HTMLElement | null = target.parentElement;
          let depth = 0;
          while (current && depth < 10) {
            // Check for explicit markers first
            if (
              current.hasAttribute('data-item') ||
              current.getAttribute('data-slot') === 'card' ||
              current.classList.contains('card')
            ) {
              return current;
            }
            current = current.parentElement;
            depth++;
          }
        }
      }
      
      // Fallback: try the ref (this should work if ItemActionsMenu found the card)
      if (itemRef.current) {
        // Check if it's already a card
        if (
          itemRef.current.hasAttribute('data-item') ||
          itemRef.current.classList.contains('card')
        ) {
          return itemRef.current;
        }
        // Try to find parent card
        const parent = itemRef.current.closest(
          '[data-item], [data-slot="card"], .card, li, .item-card, [class*="Card"], [role="article"], article'
        );
        if (parent && parent instanceof HTMLElement) {
          return parent;
        }
        return itemRef.current;
      }
      
      return null;
    };

    const element = findItemElement();
    if (element) {
      itemRef.current = element;
      
      // Ensure the element has the has-context-menu class (in case ItemActionsMenu hasn't added it yet)
      if (!element.classList.contains('has-context-menu')) {
        element.classList.add('has-context-menu');
      }
      
      const rect = element.getBoundingClientRect();
      setItemRect(rect);
      if (blockingTimeoutRef.current) {
        clearTimeout(blockingTimeoutRef.current);
        blockingTimeoutRef.current = null;
      }
      setIsBlocking(true);
      setIsOpen(true);
      menuOpenTimeRef.current = Date.now();
      onOpenChange?.(true);
      element.classList.add("context-menu-active");
      setIsPressing(false);
      const isTouchEvent =
        (event && "touches" in event) ||
        (event && "pointerType" in event && event.pointerType === "touch") ||
        (event &&
          "nativeEvent" in event &&
          event.nativeEvent &&
          "pointerType" in event.nativeEvent &&
          event.nativeEvent.pointerType === "touch");
      setIsTouchHoldActive(Boolean(isTouchEvent));
    } else {
      console.warn('CenteredContextMenu: Could not find item element', { event, itemRef: itemRef.current });
    }
  }, [disabled, onOpenChange]);

  // Long-press handler (mobile) with visual feedback
  const { longPressHandlers, gestureState, reset: resetLongPress } = useLongPress({
    onLongPress: (event) => {
      openMenu(event);
      // Don't reset immediately - let the menu stay open
    },
    onPressStart: () => {
      setIsPressing(true);
    },
    duration: 500, // Reduced for better responsiveness
    hapticFeedback: true,
  });

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
    setIsPressing(false);
    setIsTouchHoldActive(false);
    menuOpenTimeRef.current = 0;
    if (itemRef.current) {
      itemRef.current.classList.remove("context-menu-active");
      itemRef.current.classList.remove("context-menu-shifted");
      itemRef.current.style.removeProperty("--context-menu-shift");
    }
    // Reset long-press gesture state immediately
    resetLongPress();
    if (blockingTimeoutRef.current) {
      clearTimeout(blockingTimeoutRef.current);
    }
    setIsBlocking(true);
    blockingTimeoutRef.current = setTimeout(() => {
      setIsBlocking(false);
      blockingTimeoutRef.current = null;
    }, 400);
    // Delay clearing rect to allow exit animation
    setTimeout(() => {
      setItemRect(null);
      itemRef.current = null;
    }, 220);
  }, [resetLongPress, onOpenChange]);

  useEffect(() => {
    if (!isBlocking) return;
    document.body.classList.add('context-menu-open');
    return () => {
      document.body.classList.remove('context-menu-open');
    };
  }, [isBlocking]);

  useEffect(() => {
    if (!isOpen || !isTouchHoldActive) return;
    document.body.classList.add("context-menu-touch-hold");
    const clearTouchHold = (event: Event) => {
      if (
        "pointerType" in event &&
        (event as PointerEvent).pointerType !== "touch"
      ) {
        return;
      }
      setIsTouchHoldActive(false);
    };
    document.addEventListener("touchend", clearTouchHold, { capture: true });
    document.addEventListener("touchcancel", clearTouchHold, { capture: true });
    document.addEventListener("pointerup", clearTouchHold, { capture: true });
    return () => {
      document.body.classList.remove("context-menu-touch-hold");
      document.removeEventListener("touchend", clearTouchHold, { capture: true } as AddEventListenerOptions);
      document.removeEventListener("touchcancel", clearTouchHold, { capture: true } as AddEventListenerOptions);
      document.removeEventListener("pointerup", clearTouchHold, { capture: true } as AddEventListenerOptions);
    };
  }, [isOpen, isTouchHoldActive]);

  const suppressNextClick = useCallback(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      document.removeEventListener("click", handler, true);
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchend", handler, true);
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("touchend", handler, { capture: true, passive: false });
    if (suppressClickTimeoutRef.current) {
      clearTimeout(suppressClickTimeoutRef.current);
    }
    suppressClickTimeoutRef.current = setTimeout(() => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchend", handler, true);
    }, 800);
  }, []);

  useEffect(() => {
    if (!isBlocking) return;

    const handleGlobalBlock = (event: Event) => {
      const target = event.target as EventTarget | null;
      const targetElement = target instanceof Element ? target : null;
      const path = (event as Event & { composedPath?: () => EventTarget[] }).composedPath?.();
      const isMenuTarget =
        (menuRef.current && path ? path.includes(menuRef.current) : false) ||
        (menuRef.current && target ? menuRef.current.contains(target as Node) : false) ||
        Boolean(targetElement?.closest(".glass-context-menu"));

      if (isMenuTarget) {
        return;
      }

      const timeSinceOpen = Date.now() - menuOpenTimeRef.current;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (isOpen) {
        if (menuOpenTimeRef.current && timeSinceOpen < 600) {
          return;
        }
        suppressNextClick();
        closeMenu();
      }
    };

    document.addEventListener("click", handleGlobalBlock, true);
    document.addEventListener("mousedown", handleGlobalBlock, true);
    document.addEventListener("touchstart", handleGlobalBlock, { capture: true, passive: false });
    document.addEventListener("touchend", handleGlobalBlock, { capture: true, passive: false });

    return () => {
      document.removeEventListener("click", handleGlobalBlock, true);
      document.removeEventListener("mousedown", handleGlobalBlock, true);
      document.removeEventListener("touchstart", handleGlobalBlock, true);
      document.removeEventListener("touchend", handleGlobalBlock, true);
    };
  }, [isBlocking, isOpen, closeMenu, suppressNextClick]);

  // Prevent background scrolling when menu is open (Apple-style behavior)
  useEffect(() => {
    if (!isOpen) return;

    const appContent = document.querySelector(".app-content") as HTMLElement | null;
    const originalBodyOverflow = document.body.style.overflow;
    const originalAppOverflowY = appContent?.style.overflowY ?? "";
    const originalAppOverflow = appContent?.style.overflow ?? "";

    document.body.style.overflow = "hidden";
    if (appContent) {
      appContent.style.overflowY = "hidden";
      appContent.style.overflow = "hidden";
    }

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && (menuRef.current.contains(target) || menuRef.current === target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventScroll, { passive: false, capture: true });
    document.body.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    document.body.addEventListener('touchmove', preventScroll, { passive: false, capture: true });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (appContent) {
        appContent.style.overflowY = originalAppOverflowY;
        appContent.style.overflow = originalAppOverflow;
      }
      window.removeEventListener('wheel', preventScroll, { capture: true } as any);
      window.removeEventListener('touchmove', preventScroll, { capture: true } as any);
      document.body.removeEventListener('wheel', preventScroll, { capture: true } as any);
      document.body.removeEventListener('touchmove', preventScroll, { capture: true } as any);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (blockingTimeoutRef.current) {
        clearTimeout(blockingTimeoutRef.current);
        blockingTimeoutRef.current = null;
      }
      if (suppressClickTimeoutRef.current) {
        clearTimeout(suppressClickTimeoutRef.current);
        suppressClickTimeoutRef.current = null;
      }
    };
  }, []);

  // Expose open method via ref
  React.useImperativeHandle(ref, () => ({
    open: openMenu,
  }));

  const handleAction = useCallback(
    (action: CenteredContextMenuAction) => {
      // Stop any event propagation before handling action
      onAction(action);
      // Close menu with a small delay to ensure event propagation is stopped
      setTimeout(() => {
        closeMenu();
      }, 50);
    },
    [onAction, closeMenu]
  );

  const stopSyntheticEvent = (
    event:
      | React.MouseEvent
      | React.TouchEvent
      | React.PointerEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nativeEvent = event.nativeEvent as Event & {
      stopImmediatePropagation?: () => void;
    };
    nativeEvent.stopImmediatePropagation?.();
  };

  // Update pressing state based on gesture
  useEffect(() => {
    if (gestureState === "pressing") {
      setIsPressing(true);
    } else if (gestureState === "idle" || gestureState === "menu-open") {
      setIsPressing(false);
    }
  }, [gestureState]);

  // Right-click handler (desktop)
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(e);
    },
    [openMenu]
  );

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeMenu]);

  // Apply vertical shift so menu always has space below the item.
  useEffect(() => {
    if (!isOpen || !itemRef.current) return;
    if (menuShiftY > 0) {
      itemRef.current.classList.add("context-menu-shifted");
      itemRef.current.style.setProperty("--context-menu-shift", `${-menuShiftY}px`);
    } else {
      itemRef.current.classList.remove("context-menu-shifted");
      itemRef.current.style.removeProperty("--context-menu-shift");
    }
  }, [isOpen, menuShiftY]);

  // Measure full menu height after render so spacing stays accurate.
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    let rafId: number | null = null;

    const measure = () => {
      if (!menuRef.current) return;
      const nextHeight = menuRef.current.scrollHeight;
      if (nextHeight > 0) {
        setMenuHeight((prev) => (prev === nextHeight ? prev : nextHeight));
      }
    };

    measure();
    rafId = requestAnimationFrame(measure);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen, actions]);

  // Group actions
  const groupedActions = useMemo(() => {
    const standardActions = (actions || []).filter((action) =>
      STANDARD_ACTION_ORDER.includes(action)
    );
    const rubbishActions = (actions || []).filter((action) =>
      RUBBISH_ACTION_ORDER.includes(action)
    );

    const validStandardActions = STANDARD_ACTION_ORDER.filter((action) =>
      standardActions.includes(action)
    );
    const validRubbishActions = RUBBISH_ACTION_ORDER.filter((action) =>
      rubbishActions.includes(action)
    );

    const groups: {
      primary: CenteredContextMenuAction[];
      mode: CenteredContextMenuAction[];
      lifecycle: CenteredContextMenuAction[];
      destructive: CenteredContextMenuAction[];
      rubbish: CenteredContextMenuAction[];
    } = {
      primary: [],
      mode: [],
      lifecycle: [],
      destructive: [],
      rubbish: [],
    };

    validStandardActions.forEach((action) => {
      if (action === "edit" || action === "duplicate") {
        groups.primary.push(action);
      } else if (action === "select") {
        groups.mode.push(action);
      } else if (action === "archive") {
        groups.lifecycle.push(action);
      } else if (action === "delete") {
        groups.destructive.push(action);
      }
    });

    validRubbishActions.forEach((action) => {
      groups.rubbish.push(action);
    });

    // Add lifecycle actions (markAsSent/markAsPaid/revert/cancel) if present
    (actions || []).forEach((action) => {
      if (action === "markAsSent" || action === "markAsPaid" || action === "revertToDraft" || action === "revertToSent" || action === "markAsCancelled" || action === "markAsNotCancelled") {
        groups.lifecycle.push(action);
      }
    });

    return groups;
  }, [actions]);

  const renderActionItem = (action: CenteredContextMenuAction) => {
    const config = actionConfig[action];
    if (!config) return null;
    const Icon = config.icon;
    const isDestructive = config.variant === "destructive";

    const triggerAction = () => {
      const now = Date.now();
      if (now - lastActionTimeRef.current < 400) {
        return;
      }
      lastActionTimeRef.current = now;
      handleAction(action);
    };

    return (
      <button
        key={action}
        onClick={(e) => {
          // CRITICAL: Stop event propagation to prevent triggering card click
          stopSyntheticEvent(e);
          triggerAction();
        }}
        onMouseDown={(e) => {
          // Also stop on mousedown to prevent any interaction with card
          stopSyntheticEvent(e);
        }}
        onTouchStart={(e) => {
          // Stop touch events too
          stopSyntheticEvent(e);
        }}
        onTouchEnd={(e) => {
          // Trigger action on touch end for mobile reliability
          stopSyntheticEvent(e);
          triggerAction();
        }}
        className={cn(
          "glass-menu-item w-full text-left",
          isDestructive && "delete"
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{config.label}</span>
      </button>
    );
  };

  return (
    <>
      <div
        ref={wrapperRef}
        style={{
          transition: "transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          transform: isPressing && !isOpen ? "scale(0.97)" : "scale(1)",
          transformOrigin: "center center",
        }}
        onContextMenu={handleContextMenu}
        {...(!isOpen && !disabled ? longPressHandlers : {})}
      >
        <div ref={itemRef as React.RefObject<HTMLDivElement>}>
          {children}
        </div>
      </div>

      {/* Render menu in portal when open or closing */}
      {isBlocking &&
        createPortal(
          <>
            {/* Background blur layer (visual only) */}
            <div
              className="context-menu-overlay fixed inset-0 backdrop-blur-md bg-black/20"
              style={{
                zIndex: 9995,
                animation: "fadeIn 220ms ease-out",
                pointerEvents: "none",
                opacity: isOpen ? 1 : 0,
                transition: "opacity 180ms ease-out",
              }}
            />

            {/* Interaction scrim (captures taps/clicks) */}
            <div
              className="context-menu-scrim fixed inset-0"
              style={{
                zIndex: 9996,
                pointerEvents: "auto",
                background: "transparent",
                touchAction: "none",
              }}
            />

            {/* Centered menu - z-index below tab bar */}
            {isOpen &&
              itemRect &&
              itemRef.current &&
              menuStyle && (
                <div
                  ref={menuRef}
                  className={cn("glass-context-menu", menuClassName)}
                  style={{
                    ...menuStyle,
                    zIndex: 9998,
                    animation: "menuSlideUp 260ms cubic-bezier(0.16, 1, 0.3, 1)",
                    overflowY: "auto", // Enable scrolling within menu
                    overscrollBehavior: "contain", // Prevent scroll chaining to background
                    pointerEvents: "auto", // Menu must be interactive
                  }}
                  onClick={(e) => {
                    // Stop all clicks inside menu from bubbling
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => {
                    // Stop mousedown events too
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    // Stop touch events
                    e.stopPropagation();
                  }}
                >
                  {groupedActions.primary.length === 0 &&
                  groupedActions.mode.length === 0 &&
                  groupedActions.lifecycle.length === 0 &&
                  groupedActions.destructive.length === 0 &&
                  groupedActions.rubbish.length === 0 ? (
                    <div className="glass-menu-item text-muted-foreground text-xs uppercase">
                      No actions available
                    </div>
                  ) : (
                    <>
                      {/* Primary: Edit, Duplicate */}
                      {groupedActions.primary.length > 0 && (
                        <div className="menu-group">
                          {groupedActions.primary.map(renderActionItem)}
                        </div>
                      )}

                      {/* Mode: Select */}
                      {groupedActions.mode.length > 0 && (
                        <div className="menu-group">
                          {groupedActions.mode.map(renderActionItem)}
                        </div>
                      )}

                      {/* Lifecycle: Archive */}
                      {groupedActions.lifecycle.length > 0 && (
                        <div className="menu-group">
                          {groupedActions.lifecycle.map(renderActionItem)}
                        </div>
                      )}

                      {/* Rubbish: Restore, Delete Permanently */}
                      {groupedActions.rubbish.length > 0 && (
                        <div className="menu-group">
                          {groupedActions.rubbish.map(renderActionItem)}
                        </div>
                      )}

                      {/* Destructive: Delete (isolated with extra spacing) */}
                      {groupedActions.destructive.length > 0 && (
                        <div className="menu-group destructive">
                          {groupedActions.destructive.map(renderActionItem)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
          </>,
          portalRoot ?? document.body
        )}
    </>
  );
});
