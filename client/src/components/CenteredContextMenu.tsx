/**
 * CenteredContextMenu Component
 * 
 * Apple-style centered context menu with floating item preview.
 * 
 * Features:
 * - Item lifts up and scales when menu opens
 * - Menu appears centered below the floating preview
 * - Background blurs and dims
 * - Supports both three-dot button tap and long-press
 * - Smooth spring-like animations
 * 
 * Design inspired by Apple Files and Apple Maps on iOS.
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
  /** The item element to wrap (will be lifted when menu opens) */
  children: React.ReactElement;
  /** Optional three-dot button trigger */
  triggerButton?: React.ReactNode;
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

export function CenteredContextMenu({
  onAction,
  actions = ["edit", "delete"],
  children,
  triggerButton,
  disabled = false,
  menuClassName,
}: CenteredContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [itemRect, setItemRect] = useState<DOMRect | null>(null);
  const itemRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Calculate menu position (centered horizontally, below preview)
  const menuPosition = useMemo(() => {
    if (!itemRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = 200; // Approximate menu height
    const previewHeight = itemRect.height * 0.94; // Scaled preview height
    const spacing = 16; // Space between preview and menu

    // Center horizontally
    const left = viewportWidth / 2;
    
    // Position menu below preview, centered vertically in remaining space
    const previewTop = viewportHeight / 2 - previewHeight / 2 - menuHeight / 2 - spacing / 2;
    const menuTop = previewTop + previewHeight + spacing;

    return {
      top: `${menuTop}px`,
      left: `${left}px`,
      transform: "translateX(-50%)",
    };
  }, [itemRect]);

  // Calculate preview position (centered, lifted up)
  const previewPosition = useMemo(() => {
    if (!itemRect) return { top: "50%", left: "50%", transform: "translate(-50%, -50%) scale(0.94)" };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuHeight = 200; // Approximate menu height
    const spacing = 16;

    // Center horizontally
    const left = viewportWidth / 2;
    
    // Center preview above menu
    const previewHeight = itemRect.height * 0.94;
    const totalHeight = previewHeight + spacing + menuHeight;
    const top = viewportHeight / 2 - totalHeight / 2;

    return {
      top: `${top}px`,
      left: `${left}px`,
      transform: "translateX(-50%) scale(0.94)",
    };
  }, [itemRect]);

  const openMenu = useCallback(() => {
    if (disabled) return;

    // Find the item element - look for parent card/item
    const findItemElement = (): HTMLElement | null => {
      // First try the ref
      if (itemRef.current) {
        const parent = itemRef.current.closest('.card, [data-item], li, .item-card, [class*="Card"]');
        if (parent) return parent as HTMLElement;
        return itemRef.current;
      }
      
      // If trigger button was clicked, find the parent item
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement) {
        const parent = activeElement.closest('.card, [data-item], li, .item-card, [class*="Card"]');
        if (parent) return parent as HTMLElement;
      }
      
      return null;
    };

    const element = findItemElement();
    if (element) {
      itemRef.current = element;
      const rect = element.getBoundingClientRect();
      setItemRect(rect);
      setIsOpen(true);
    }
  }, [disabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    // Delay clearing rect to allow exit animation
    setTimeout(() => {
      setItemRect(null);
      itemRef.current = null;
    }, 300);
  }, []);

  const handleAction = useCallback(
    (action: CenteredContextMenuAction) => {
      onAction(action);
      closeMenu();
    },
    [onAction, closeMenu]
  );

  // Long-press handler
  const { longPressHandlers } = useLongPress({
    onLongPress: () => {
      openMenu();
    },
    duration: 450,
    hapticFeedback: true,
  });

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
        onClick={() => handleAction(action)}
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
          opacity: isOpen ? 0 : 1,
          transition: "opacity 200ms ease-out",
        }}
        {...(!isOpen ? longPressHandlers : {})}
      >
        <div ref={itemRef}>{children}</div>
      </div>

      {triggerButton && (
        <div
          data-trigger-button
          onClick={(e) => {
            e.stopPropagation();
            openMenu();
          }}
          {...(!isOpen ? longPressHandlers : {})}
        >
          {triggerButton}
        </div>
      )}

      {/* Render menu in portal when open */}
      {isOpen &&
        itemRect &&
        createPortal(
          <>
            {/* Background overlay with blur */}
            <div
              className="fixed inset-0 z-[100] backdrop-blur-md bg-black/20"
              onClick={closeMenu}
              style={{
                animation: "fadeIn 200ms ease-out",
              }}
            />

            {/* Floating item preview */}
            {itemRef.current && (
              <div
                className="fixed z-[101] pointer-events-none"
                style={{
                  ...previewPosition,
                  width: `${itemRect.width}px`,
                  height: `${itemRect.height}px`,
                  animation: "itemLift 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                <div
                  className="w-full h-full"
                  style={{
                    transform: "scale(0.94)",
                    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)",
                    borderRadius: "inherit",
                    overflow: "hidden",
                  }}
                  dangerouslySetInnerHTML={{
                    __html: itemRef.current.outerHTML,
                  }}
                />
              </div>
            )}

            {/* Centered menu */}
            <div
              ref={menuRef}
              className={cn("fixed z-[102] glass-context-menu", menuClassName)}
              style={{
                ...menuPosition,
                animation: "menuSlideUp 300ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                maxWidth: "280px",
                width: "auto",
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
}

