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
  const itemRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Calculate menu position (anchored above/below the pressed item)
  const menuStyle = useMemo(() => {
    if (!itemRect) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 240; // Approximate menu width
    const spacing = 12;
    const edgePadding = 12;

    const centeredLeft = itemRect.left + itemRect.width / 2;
    const left = Math.min(
      Math.max(centeredLeft, edgePadding + menuWidth / 2),
      viewportWidth - edgePadding - menuWidth / 2
    );

    const availableBelow = viewportHeight - itemRect.bottom - spacing - edgePadding;
    const availableAbove = itemRect.top - spacing - edgePadding;
    const canFitBelow = availableBelow >= menuHeight;
    const canFitAbove = availableAbove >= menuHeight;
    const placeBelow = canFitBelow || (!canFitAbove && availableBelow >= availableAbove);
    const maxHeight = Math.max(120, placeBelow ? availableBelow : availableAbove);

    return {
      position: "fixed" as const,
      top: placeBelow ? `${itemRect.bottom + spacing}px` : undefined,
      bottom: placeBelow ? undefined : `${viewportHeight - itemRect.top + spacing}px`,
      left: `${left}px`,
      transform: "translateX(-50%)",
      zIndex: 1002,
      maxWidth: "calc(100vw - 24px)",
      maxHeight: `${maxHeight}px`,
      width: "auto",
    };
  }, [itemRect, menuHeight]);

  const openMenu = useCallback((event?: PointerEvent | TouchEvent | React.MouseEvent) => {
    if (disabled) return;

    // Find the item element
    const findItemElement = (): HTMLElement | null => {
      // If we have an event, use it to find the element
      if (event) {
        const target = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
        if (target) {
          // Look for parent card/item
          const parent = target.closest(
            '[data-slot="card"], .card, [data-item], li, .item-card, [class*="Card"], [role="article"], article'
          );
          if (parent) return parent as HTMLElement;
          
          // Try going up a few levels
          let current: HTMLElement | null = target.parentElement;
          let depth = 0;
          while (current && depth < 5) {
            if (
              current.getAttribute('data-slot') === 'card' ||
              current.classList.contains('card') ||
              current.hasAttribute('data-item')
            ) {
              return current;
            }
            const styles = window.getComputedStyle(current);
            if (
              styles.borderRadius !== '0px' ||
              styles.boxShadow !== 'none' ||
              styles.padding !== '0px'
            ) {
              return current;
            }
            current = current.parentElement;
            depth++;
          }
        }
      }
      
      // Fallback: try the ref
      if (itemRef.current) {
        const parent = itemRef.current.closest(
          '[data-slot="card"], .card, [data-item], li, .item-card, [class*="Card"], [role="article"], article'
        );
        if (parent) return parent as HTMLElement;
        return itemRef.current;
      }
      
      return null;
    };

    const element = findItemElement();
    if (element) {
      itemRef.current = element;
      const rect = element.getBoundingClientRect();
      setItemRect(rect);
      setIsOpen(true);
      onOpenChange?.(true);
      element.classList.add("context-menu-active");
      setIsPressing(false);
      
      // Prevent accidental clicks - menu items become clickable after a delay
      setMenuItemsClickable(false);
      setTimeout(() => {
        setMenuItemsClickable(true);
      }, 300); // 300ms cooldown before items are clickable
    }
  }, [disabled, onOpenChange]);

  // Long-press handler (mobile) with visual feedback
  const { longPressHandlers, gestureState, reset: resetLongPress } = useLongPress({
    onLongPress: (event) => {
      openMenu(event);
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
    if (itemRef.current) {
      itemRef.current.classList.remove("context-menu-active");
    }
    // Reset long-press gesture state immediately
    resetLongPress();
    // Delay clearing rect to allow exit animation
    setTimeout(() => {
      setItemRect(null);
      itemRef.current = null;
    }, 220);
  }, [resetLongPress, onOpenChange]);

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
        (target as HTMLElement)?.closest('.context-menu-overlay');
      
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
          
          if (!menuItemsClickable) return; // Prevent clicks during cooldown
          handleAction(action);
        }}
        onMouseDown={(e) => {
          // Also stop on mousedown to prevent any interaction with card
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          // Stop touch events too
          e.stopPropagation();
        }}
        disabled={!menuItemsClickable}
        className={cn(
          "glass-menu-item w-full text-left transition-opacity",
          isDestructive && "delete",
          !menuItemsClickable && "opacity-50 pointer-events-none"
        )}
        style={{
          pointerEvents: menuItemsClickable ? "auto" : "none",
        }}
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
            {/* Background overlay with blur - z-index 1000 */}
            <div
              className="context-menu-overlay fixed inset-0 backdrop-blur-md bg-black/20"
              style={{
                zIndex: 1000,
                animation: "fadeIn 220ms ease-out",
                pointerEvents: "auto", // Ensure overlay captures all pointer events
              }}
              onClick={(e) => {
                // CRITICAL: Stop all clicks on background from reaching cards
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }}
              onMouseDown={(e) => {
                // Stop mousedown events too - prevent card clicks
                e.preventDefault();
                e.stopPropagation();
                // Close menu immediately on mousedown
                closeMenu();
              }}
              onTouchStart={(e) => {
                // Stop touch events - prevent card clicks
                e.preventDefault();
                e.stopPropagation();
                // Close menu on touch
                closeMenu();
              }}
              onTouchEnd={(e) => {
                // Also stop touchend to prevent any lingering events
                e.preventDefault();
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                // Catch all pointer events (mouse, touch, pen)
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
              }}
            />

            {/* Centered menu - z-index 1002 */}
            <div
              ref={menuRef}
              className={cn("glass-context-menu", menuClassName)}
              style={{
                ...menuStyle,
                animation: "menuSlideUp 260ms cubic-bezier(0.16, 1, 0.3, 1)",
                overflowY: "auto", // Enable scrolling within menu
                overscrollBehavior: "contain", // Prevent scroll chaining to background
              }}
              onClick={(e) => {
                // Stop all clicks inside menu from bubbling to card
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
