/**
 * CenteredContextMenu Component
 * 
 * Apple-style centered context menu with floating item preview.
 * 
 * Interaction Model:
 * - Mobile: Long-press (550ms) opens menu, single tap = primary action
 * - Desktop: Right-click opens menu, single click = primary action
 * - No three-dot button (removed for cleaner UI)
 * 
 * Animation: Transform-only, preview appears instantly at final position
 * Z-index: Preview (top) > Menu > Overlay > Background
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
  { open: (event?: PointerEvent | React.MouseEvent) => void },
  CenteredContextMenuProps
>(({
  onAction,
  actions = ["edit", "delete"],
  children,
  disabled = false,
  menuClassName,
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [menuItemsClickable, setMenuItemsClickable] = useState(false);
  const [itemRect, setItemRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Calculate preview position (centered, above menu) - INSTANT positioning
  const previewStyle = useMemo(() => {
    if (!itemRect) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = 200; // Approximate menu height
    const spacing = 16;
    const scale = 0.94;

    // Center horizontally
    const left = viewportWidth / 2;
    
    // Center preview above menu
    const previewHeight = itemRect.height * scale;
    const totalHeight = previewHeight + spacing + menuHeight;
    const top = viewportHeight / 2 - totalHeight / 2;

    return {
      position: "fixed" as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${itemRect.width}px`,
      height: `${itemRect.height}px`,
      transform: "translateX(-50%) scale(0.94)",
      transformOrigin: "center center",
      zIndex: 1001,
      pointerEvents: "none" as const,
    };
  }, [itemRect]);

  // Calculate menu position (centered horizontally, below preview)
  const menuStyle = useMemo(() => {
    if (!itemRect) return null;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = 200;
    const previewHeight = itemRect.height * 0.94;
    const spacing = 16;

    // Center horizontally
    const left = viewportWidth / 2;
    
    // Position menu below preview
    const previewTop = viewportHeight / 2 - previewHeight / 2 - menuHeight / 2 - spacing / 2;
    const menuTop = previewTop + previewHeight + spacing;

    return {
      position: "fixed" as const,
      top: `${menuTop}px`,
      left: `${left}px`,
      transform: "translateX(-50%)",
      zIndex: 1002,
      maxWidth: "280px",
      width: "auto",
    };
  }, [itemRect]);

  const openMenu = useCallback((event?: PointerEvent | React.MouseEvent) => {
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
      setIsPressing(false);
      
      // Prevent accidental clicks - menu items become clickable after a delay
      setMenuItemsClickable(false);
      setTimeout(() => {
        setMenuItemsClickable(true);
      }, 300); // 300ms cooldown before items are clickable
    }
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    // Delay clearing rect to allow exit animation
    setTimeout(() => {
      setItemRect(null);
      itemRef.current = null;
    }, 220);
  }, []);

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
      onAction(action);
      closeMenu();
    },
    [onAction, closeMenu]
  );

  // Long-press handler (mobile) with visual feedback
  const { longPressHandlers, gestureState } = useLongPress({
    onLongPress: (event) => {
      openMenu(event);
    },
    onPressStart: () => {
      setIsPressing(true);
    },
    duration: 500, // Reduced for better responsiveness
    hapticFeedback: true,
  });

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
      openMenu(e.nativeEvent);
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

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        previewRef.current &&
        !previewRef.current.contains(target) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(target)
      ) {
        closeMenu();
      }
    };

    // Use a slight delay to avoid immediate close on open
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
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
        onClick={() => {
          if (!menuItemsClickable) return; // Prevent clicks during cooldown
          handleAction(action);
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
          opacity: isOpen ? 0 : 1,
          transition: "opacity 180ms ease-out, transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          transform: isPressing && !isOpen ? "scale(0.97)" : "scale(1)",
          transformOrigin: "center center",
        }}
        onContextMenu={handleContextMenu}
        onSelectStart={(e) => {
          // Prevent text selection during press - but allow in inputs
          const target = e.target as HTMLElement;
          if (
            isPressing || isOpen
          ) {
            // Allow selection in inputs, textareas, and contenteditable
            if (
              target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              target.isContentEditable ||
              target.closest('input, textarea, select, [contenteditable]')
            ) {
              return; // Allow selection in these elements
            }
            e.preventDefault();
          }
        }}
        onDragStart={(e) => {
          // Prevent drag during press - but allow in inputs
          const target = e.target as HTMLElement;
          if (isPressing || isOpen) {
            if (
              target.tagName === 'INPUT' ||
              target.tagName === 'TEXTAREA' ||
              target.tagName === 'SELECT' ||
              target.closest('input, textarea, select')
            ) {
              return; // Allow drag in inputs
            }
            e.preventDefault();
          }
        }}
        {...(!isOpen && !disabled ? longPressHandlers : {})}
      >
        <div ref={itemRef}>
          {children}
        </div>
      </div>

      {/* Render menu in portal when open */}
      {isOpen &&
        itemRect &&
        itemRef.current &&
        previewStyle &&
        menuStyle &&
        createPortal(
          <>
            {/* Background overlay with blur - z-index 1000 */}
            <div
              className="fixed inset-0 backdrop-blur-md bg-black/20"
              onClick={closeMenu}
              style={{
                zIndex: 1000,
                animation: "fadeIn 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            />

            {/* Floating item preview - z-index 1001, appears instantly at final position */}
            <div
              ref={previewRef}
              style={{
                ...previewStyle,
                animation: "previewAppear 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              }}
            >
              <div
                className="w-full h-full"
                style={{
                  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                  borderRadius: "inherit",
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{
                  __html: itemRef.current.outerHTML,
                }}
              />
            </div>

            {/* Centered menu - z-index 1002 */}
            <div
              ref={menuRef}
              className={cn("glass-context-menu", menuClassName)}
              style={{
                ...menuStyle,
                animation: "menuSlideUp 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
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
