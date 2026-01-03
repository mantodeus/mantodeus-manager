/**
 * ItemActionsMenu Component
 * 
 * Applies context menu handlers to parent card/item element.
 * 
 * NO THREE-DOT BUTTON - uses long-press (mobile) or right-click (desktop).
 * 
 * This component finds the parent card and applies handlers to it.
 * It renders nothing visible - just applies event handlers.
 */

import { useEffect, useRef } from "react";
import { CenteredContextMenu, CenteredContextMenuAction } from "@/components/CenteredContextMenu";
import { useLongPress } from "@/hooks/useLongPress";

export type ItemAction = CenteredContextMenuAction;

interface ItemActionsMenuProps {
  /** Callback when an action is selected */
  onAction: (action: ItemAction) => void;
  /** Available actions to show in the menu (order is enforced) */
  actions?: ItemAction[];
  /** Whether the menu is disabled */
  disabled?: boolean;
  /** Custom className (kept for backward compatibility, but not used) */
  triggerClassName?: string;
  /** Size (kept for backward compatibility, but not used) */
  size?: "sm" | "md" | "lg";
}

/**
 * This component applies context menu handlers to the parent card element.
 * It renders nothing - just a marker that applies handlers via useEffect.
 */
export function ItemActionsMenu({
  onAction,
  actions = ["edit", "delete"],
  disabled = false,
  triggerClassName,
  size,
}: ItemActionsMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<{ open: (event?: PointerEvent | React.MouseEvent) => void } | null>(null);

  // Long-press handler
  const { longPressHandlers } = useLongPress({
    onLongPress: (event) => {
      menuRef.current?.open(event);
    },
    duration: 550,
    hapticFeedback: true,
  });

  // Right-click handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    menuRef.current?.open(e.nativeEvent);
  };

  // Apply handlers to parent card element
  useEffect(() => {
    if (disabled || !containerRef.current) return;

    const findParentCard = (): HTMLElement | null => {
      let current: HTMLElement | null = containerRef.current?.parentElement || null;
      let depth = 0;
      while (current && depth < 10) {
        if (
          current.getAttribute('data-slot') === 'card' ||
          current.classList.contains('card') ||
          current.hasAttribute('data-item')
        ) {
          return current;
        }
        current = current.parentElement;
        depth++;
      }
      return null;
    };

    const cardElement = findParentCard();
    if (!cardElement) return;

    // Apply pointer event handlers for long-press
    const pointerDownHandler = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== undefined) return;
      
      // Don't interfere with inputs, buttons, links, or other interactive elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, button, a, [contenteditable]')
      ) {
        return; // Let these elements work normally
      }
      
      // Prevent text selection immediately
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
      longPressHandlers.onPointerDown?.(e as any);
    };
    
    // Prevent text selection - but only for non-interactive elements
    const selectStartHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable]')
      ) {
        return; // Allow selection in inputs
      }
      e.preventDefault();
      e.stopPropagation();
    };
    
    const dragStartHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.closest('input, textarea, select')
      ) {
        return; // Allow drag in inputs
      }
      e.preventDefault();
      e.stopPropagation();
    };
    const pointerMoveHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerMove?.(e as any);
    };
    const pointerUpHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerUp?.(e as any);
    };
    const pointerCancelHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerCancel?.(e as any);
    };
    const clickHandler = (e: MouseEvent) => {
      longPressHandlers.onClick?.(e as any);
    };

    // Apply right-click handler
    const contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      menuRef.current?.open(e);
    };

    // Don't apply user-select: none globally - it breaks inputs
    // Only prevent selection during actual long-press via event handlers

    cardElement.addEventListener('pointerdown', pointerDownHandler);
    cardElement.addEventListener('pointermove', pointerMoveHandler);
    cardElement.addEventListener('pointerup', pointerUpHandler);
    cardElement.addEventListener('pointercancel', pointerCancelHandler);
    cardElement.addEventListener('click', clickHandler);
    cardElement.addEventListener('contextmenu', contextMenuHandler);
    cardElement.addEventListener('selectstart', selectStartHandler);
    cardElement.addEventListener('dragstart', dragStartHandler);

    return () => {
      cardElement.removeEventListener('pointerdown', pointerDownHandler);
      cardElement.removeEventListener('pointermove', pointerMoveHandler);
      cardElement.removeEventListener('pointerup', pointerUpHandler);
      cardElement.removeEventListener('pointercancel', pointerCancelHandler);
      cardElement.removeEventListener('click', clickHandler);
      cardElement.removeEventListener('contextmenu', contextMenuHandler);
      cardElement.removeEventListener('selectstart', selectStartHandler);
      cardElement.removeEventListener('dragstart', dragStartHandler);
    };
  }, [disabled, longPressHandlers]);

  if (!onAction || typeof onAction !== 'function') {
    console.error('ItemActionsMenu: onAction prop is required and must be a function');
    return null;
  }

  // Render invisible marker and menu system
  return (
    <>
      <div ref={containerRef} style={{ display: 'none' }} />
      <CenteredContextMenu
        ref={menuRef}
        onAction={onAction}
        actions={actions}
        disabled={disabled}
      >
        <div style={{ display: "none" }} />
      </CenteredContextMenu>
    </>
  );
}
