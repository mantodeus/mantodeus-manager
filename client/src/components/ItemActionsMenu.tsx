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
  const { longPressHandlers, reset: resetLongPress } = useLongPress({
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
    if (!cardElement) {
      console.warn('ItemActionsMenu: Could not find parent card element');
      return;
    }
    
    // Add a class to identify this card for CSS targeting
    cardElement.classList.add('has-context-menu');

    // Track if we're currently pressing to apply CSS
    let isPressing = false;

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
      
      // Prevent text selection immediately - clear any existing selection
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
      
      // Apply CSS to prevent selection
      isPressing = true;
      cardElement.style.userSelect = 'none';
      (cardElement.style as any).webkitUserSelect = 'none';
      (cardElement.style as any).mozUserSelect = 'none';
      (cardElement.style as any).msUserSelect = 'none';
      
      longPressHandlers.onPointerDown?.(e as any);
    };
    
    const pointerUpHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerUp?.(e as any);
      
      // Restore user-select after a delay
      setTimeout(() => {
        if (!isPressing) {
          cardElement.style.userSelect = '';
          (cardElement.style as any).webkitUserSelect = '';
          (cardElement.style as any).mozUserSelect = '';
          (cardElement.style as any).msUserSelect = '';
        }
      }, 100);
    };
    
    const pointerCancelHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerCancel?.(e as any);
      isPressing = false;
      cardElement.style.userSelect = '';
      (cardElement.style as any).webkitUserSelect = '';
      (cardElement.style as any).mozUserSelect = '';
      (cardElement.style as any).msUserSelect = '';
    };
    
    // Prevent text selection - use CAPTURE phase to catch it early
    const selectStartHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      
      // Always allow selection in inputs, textareas, and contenteditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable]')
      ) {
        return; // Allow selection in these elements
      }
      
      // Prevent all other text selection
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
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
    
    // Also prevent mousedown from starting selection
    const mouseDownHandler = (e: MouseEvent) => {
      // Don't interfere with inputs, buttons, links
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
        return;
      }
      
      // Prevent text selection on mousedown
      if (e.button === 0) { // Left mouse button
        if (document.getSelection) {
          const selection = document.getSelection();
          if (selection) {
            selection.removeAllRanges();
          }
        }
      }
    };
    const pointerMoveHandler = (e: PointerEvent) => {
      longPressHandlers.onPointerMove?.(e as any);
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

    // Apply event listeners - use CAPTURE phase for selectstart to catch it early
    cardElement.addEventListener('pointerdown', pointerDownHandler, true);
    cardElement.addEventListener('pointermove', pointerMoveHandler, true);
    cardElement.addEventListener('pointerup', pointerUpHandler, true);
    cardElement.addEventListener('pointercancel', pointerCancelHandler, true);
    cardElement.addEventListener('click', clickHandler, true);
    cardElement.addEventListener('contextmenu', contextMenuHandler, true);
    cardElement.addEventListener('selectstart', selectStartHandler, true); // CAPTURE phase
    cardElement.addEventListener('dragstart', dragStartHandler, true);
    cardElement.addEventListener('mousedown', mouseDownHandler, true); // Also catch mousedown

    return () => {
      cardElement.removeEventListener('pointerdown', pointerDownHandler, true);
      cardElement.removeEventListener('pointermove', pointerMoveHandler, true);
      cardElement.removeEventListener('pointerup', pointerUpHandler, true);
      cardElement.removeEventListener('pointercancel', pointerCancelHandler, true);
      cardElement.removeEventListener('click', clickHandler, true);
      cardElement.removeEventListener('contextmenu', contextMenuHandler, true);
      cardElement.removeEventListener('selectstart', selectStartHandler, true);
      cardElement.removeEventListener('dragstart', dragStartHandler, true);
      cardElement.removeEventListener('mousedown', mouseDownHandler, true);
      
      // Clear any pending timeout
      if (pressTimeout) {
        clearTimeout(pressTimeout);
        pressTimeout = null;
      }
      
      // Clean up CSS and reset gesture state
      restoreUserSelect();
      resetLongPress();
      cardElement.style.pointerEvents = originalPointerEvents;
      cardElement.classList.remove('has-context-menu');
    };
  }, [disabled, longPressHandlers, resetLongPress]);

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
