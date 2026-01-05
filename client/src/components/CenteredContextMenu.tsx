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

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useLongPress } from "@/hooks/useLongPress";
import { cn } from "@/lib/utils";
import { Edit, Trash2, Copy, CheckCircle2, Archive, RotateCcw, Eye, DollarSign, XCircle } from "@/components/ui/Icon";

export type CenteredContextMenuAction =
  | "edit"
  | "duplicate"
  | "select"
  | "archive"
  | "delete"
  | "restore"
  | "deletePermanently"
  | "view"
  | "markAsPaid"
  | "markAsInOrder"
  | "void"
  | "revertToDraft"
  | "revertToSent";

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
  revertToDraft: { icon: RotateCcw, label: "Mark as not sent", variant: "destructive" },
  revertToSent: { icon: RotateCcw, label: "Mark as not paid", variant: "destructive" },
  markAsPaid: { icon: DollarSign, label: "Mark as paid", variant: "default" },
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
  const [isPressing, setIsPressing] = useState(false);
  const [menuItemsClickable, setMenuItemsClickable] = useState(false);
  const [itemRect, setItemRect] = useState<DOMRect | null>(null);
  const [menuHeight, setMenuHeight] = useState(200);
  const menuOpenTimeRef = useRef(0);
  const itemRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayPressRef = useRef(false);
  const suppressClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const menuShiftY = useMemo(() => {
    if (!itemRect || !itemRef.current) return 0;

    const viewportHeight = window.innerHeight;
    const spacing = 12;
    const edgePadding = 12;
    const bottomObstruction = getBottomObstructionHeight();

    const availableBelow =
      viewportHeight - bottomObstruction - itemRect.bottom - spacing - edgePadding;
    const requiredShift = Math.max(0, menuHeight - availableBelow);
    if (requiredShift <= 0) return 0;

    const parent = itemRef.current.parentElement;
    if (!parent) {
      return Math.min(requiredShift, Math.max(0, itemRect.top - edgePadding));
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
    const step = prevRect ? itemRect.top - prevRect.top : itemRect.height + spacing;
    const safeStep = step > 0 ? step : itemRect.height + spacing;
    const snappedShift = Math.ceil(requiredShift / safeStep) * safeStep;
    const maxShift = Math.max(0, itemRect.top - edgePadding);

    return Math.min(snappedShift, maxShift);
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

    const adjustedBottom = itemRect.bottom - menuShiftY;
    const availableBelow =
      viewportHeight - bottomObstruction - adjustedBottom - spacing - edgePadding;
    const maxHeight = Math.max(120, availableBelow);

    return {
      position: "fixed" as const,
      top: `${adjustedBottom + spacing}px`,
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
      setIsOpen(true);
      menuOpenTimeRef.current = Date.now();
      onOpenChange?.(true);
      element.classList.add("context-menu-active");
      setIsPressing(false);
      
      // Make menu items clickable immediately - no cooldown needed
      // The blocker will prevent accidental card clicks
      setMenuItemsClickable(true);
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
    menuOpenTimeRef.current = 0; // Reset menu open time
    if (itemRef.current) {
      itemRef.current.classList.remove("context-menu-active");
      itemRef.current.classList.remove("context-menu-shifted");
      itemRef.current.style.removeProperty("--context-menu-shift");
    }
    // Reset long-press gesture state immediately
    resetLongPress();
    // Delay clearing rect to allow exit animation
    setTimeout(() => {
      setItemRect(null);
      itemRef.current = null;
    }, 220);
  }, [resetLongPress, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('context-menu-open');
    return () => {
      document.body.classList.remove('context-menu-open');
    };
  }, [isOpen]);

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
    document.addEventListener("touchend", handler, true);
    if (suppressClickTimeoutRef.current) {
      clearTimeout(suppressClickTimeoutRef.current);
    }
    suppressClickTimeoutRef.current = setTimeout(() => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("touchend", handler, true);
    }, 400);
  }, []);

  const handleScrimPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      overlayPressRef.current = true;
    },
    []
  );

  const handleScrimPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!overlayPressRef.current) return;
      overlayPressRef.current = false;
      const timeSinceMenuOpen = Date.now() - menuOpenTimeRef.current;
      if (timeSinceMenuOpen < 250) {
        return;
      }
      suppressNextClick();
      closeMenu();
    },
    [closeMenu, suppressNextClick]
  );

  const handleScrimTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    overlayPressRef.current = true;
  }, []);

  const handleScrimTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!overlayPressRef.current) return;
      overlayPressRef.current = false;
      const timeSinceMenuOpen = Date.now() - menuOpenTimeRef.current;
      if (timeSinceMenuOpen < 250) {
        return;
      }
      suppressNextClick();
      closeMenu();
    },
    [closeMenu, suppressNextClick]
  );

  const handleScrimClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Prevent background scrolling when menu is open (Apple-style behavior)
  useEffect(() => {
    if (!isOpen) return;

    // Store original body styles and scroll position
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTop = document.body.style.top;
    const scrollY = window.scrollY;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    // Also prevent scroll events on window
    const preventScroll = (e: Event) => {
      // Allow scrolling within the menu itself
      const target = e.target as HTMLElement;
      if (
        menuRef.current &&
        (menuRef.current.contains(target) || menuRef.current === target)
      ) {
        return; // Allow scrolling in menu
      }
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent touchmove on body (mobile scroll prevention)
    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Allow touchmove within the menu
      if (
        menuRef.current &&
        (menuRef.current.contains(target) || menuRef.current === target)
      ) {
        return; // Allow touch scrolling in menu
      }
      e.preventDefault();
    };

    // Prevent wheel events on window (desktop scroll prevention)
    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    document.body.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    document.body.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });

    return () => {
      // Restore original body styles
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.top = originalBodyTop;

      // Restore scroll position
      window.scrollTo(0, scrollY);

      // Remove event listeners
      window.removeEventListener('wheel', preventScroll, { capture: true } as any);
      window.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      document.body.removeEventListener('wheel', preventScroll, { capture: true } as any);
      document.body.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
    };
  }, [isOpen]);

  // Expose open method via ref
  React.useImperativeHandle(ref, () => ({
    open: openMenu,
  }));

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

  // Measure menu height after render so spacing is consistent above/below.
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.height > 0 && rect.height !== menuHeight) {
      setMenuHeight(rect.height);
    }
  }, [isOpen, menuHeight]);

  // Close on outside click - but the overlay div handles this directly
  // This is kept as a fallback for edge cases
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Check if click is on the overlay background (not menu or item)
      const isOverlay = (target as HTMLElement)?.classList?.contains('context-menu-overlay') ||
        (target as HTMLElement)?.closest('.context-menu-overlay') ||
        (target as HTMLElement)?.classList?.contains('context-menu-scrim') ||
        (target as HTMLElement)?.closest('.context-menu-scrim');
      
      if (isOverlay) {
        // Overlay click - stop propagation and close
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        return;
      }
      
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        // Click outside menu and item - close menu
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      }
    };

    // Use a slight delay to avoid immediate close on open
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true); // Use capture phase
      document.addEventListener("touchstart", handleClickOutside, true); // Use capture phase
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isOpen, closeMenu]);

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

    return groups;
  }, [actions]);

  const renderActionItem = (action: CenteredContextMenuAction) => {
    const config = actionConfig[action];
    if (!config) return null;
    const Icon = config.icon;
    const isDestructive = config.variant === "destructive";

    return (
      <button
        key={action}
        onClick={(e) => {
          // CRITICAL: Stop event propagation to prevent triggering card click
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          handleAction(action);
        }}
        onMouseDown={(e) => {
          // Also stop on mousedown to prevent any interaction with card
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }}
        onTouchStart={(e) => {
          // Stop touch events too
          e.stopPropagation();
          e.stopImmediatePropagation();
        }}
        onTouchEnd={(e) => {
          // Stop touch end events
          e.stopPropagation();
          e.stopImmediatePropagation();
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

      {/* Render menu in portal when open */}
      {isOpen &&
        itemRect &&
        itemRef.current &&
        menuStyle &&
        createPortal(
          <>
            {/* Background blur layer (visual only) */}
            <div
              className="context-menu-overlay fixed inset-0 backdrop-blur-md bg-black/20"
              style={{
                zIndex: 9995,
                animation: "fadeIn 220ms ease-out",
                pointerEvents: "none",
              }}
            />

            {/* Interaction scrim (captures taps/clicks) */}
            <div
              className="context-menu-scrim fixed inset-0"
              style={{
                zIndex: 9996,
                pointerEvents: "auto",
                background: "transparent",
              }}
              onPointerDown={handleScrimPointerDown}
              onPointerUp={handleScrimPointerUp}
              onClick={handleScrimClick}
              onTouchStart={handleScrimTouchStart}
              onTouchEnd={handleScrimTouchEnd}
            />

            {/* Centered menu - z-index below tab bar */}
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
          </>,
          document.body
        )}
    </>
  );
});
