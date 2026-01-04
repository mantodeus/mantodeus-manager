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
  const menuRef = useRef<{ open: (event?: PointerEvent | TouchEvent | React.MouseEvent) => void } | null>(null);
  const cardElementRef = useRef<HTMLElement | null>(null);
  const isMenuOpenRef = useRef(false); // Track if menu is open to prevent card clicks

  // Long-press handler
  const { longPressHandlers, reset: resetLongPress } = useLongPress({
    onLongPress: (event) => {
      menuRef.current?.open(event);
    },
    duration: 550,
    hapticFeedback: true,
  });
  const longPressHandlersRef = useRef(longPressHandlers);

  useEffect(() => {
    longPressHandlersRef.current = longPressHandlers;
  }, [longPressHandlers]);

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
    cardElementRef.current = cardElement;

    // Track if we're currently pressing to apply CSS
    let isPressing = false;
    let pressTimeout: NodeJS.Timeout | null = null;

    // Helper to restore user-select
    const restoreUserSelect = () => {
      cardElement.style.userSelect = '';
      (cardElement.style as any).webkitUserSelect = '';
      (cardElement.style as any).mozUserSelect = '';
      (cardElement.style as any).msUserSelect = '';
      isPressing = false;
    };

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

      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        cardElement.classList.add('context-menu-pressing');
      }
      
      // Prevent text selection immediately - clear any existing selection
      if (document.getSelection) {
        const selection = document.getSelection();
        if (selection) {
          selection.removeAllRanges();
        }
      }
      
      // Clear any existing timeout
      if (pressTimeout) {
        clearTimeout(pressTimeout);
        pressTimeout = null;
      }
      
      // Apply CSS to prevent selection
      isPressing = true;
      cardElement.style.userSelect = 'none';
      (cardElement.style as any).webkitUserSelect = 'none';
      (cardElement.style as any).mozUserSelect = 'none';
      (cardElement.style as any).msUserSelect = 'none';
      
      longPressHandlersRef.current.onPointerDown?.(e as any);
    };
    
    const pointerUpHandler = (e: PointerEvent) => {
      longPressHandlersRef.current.onPointerUp?.(e as any);
      cardElement.classList.remove('context-menu-pressing');
      
      // Clear any existing timeout
      if (pressTimeout) {
        clearTimeout(pressTimeout);
        pressTimeout = null;
      }
      
      // Restore user-select after a short delay to ensure gesture completes
      pressTimeout = setTimeout(() => {
        restoreUserSelect();
      }, 150);
    };
    
    const pointerCancelHandler = (e: PointerEvent) => {
      longPressHandlersRef.current.onPointerCancel?.(e as any);
      cardElement.classList.remove('context-menu-pressing');
      
      // Clear any existing timeout
      if (pressTimeout) {
        clearTimeout(pressTimeout);
        pressTimeout = null;
      }
      
      restoreUserSelect();
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
      longPressHandlersRef.current.onPointerMove?.(e as any);
    };
    const clickHandler = (e: MouseEvent) => {
      // If menu is open, prevent card clicks from triggering
      if (isMenuOpenRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      longPressHandlersRef.current.onClick?.(e as any);
    };
    const touchStartHandler = (e: TouchEvent) => {
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
      cardElement.classList.add('context-menu-pressing');
      longPressHandlersRef.current.onTouchStart?.(e as any);
    };
    const touchMoveHandler = (e: TouchEvent) => {
      longPressHandlersRef.current.onTouchMove?.(e as any);
    };
    const touchEndHandler = (e: TouchEvent) => {
      cardElement.classList.remove('context-menu-pressing');
      longPressHandlersRef.current.onTouchEnd?.(e as any);
    };
    const touchCancelHandler = (e: TouchEvent) => {
      cardElement.classList.remove('context-menu-pressing');
      longPressHandlersRef.current.onTouchCancel?.(e as any);
    };

    // Apply right-click handler
    const contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      menuRef.current?.open(e);
    };

    // Ensure pointer events work on the entire card (not blocked by children)
    // This allows long-press to work anywhere on the item
    const originalPointerEvents = cardElement.style.pointerEvents;
    cardElement.style.pointerEvents = 'auto';
    
    // Apply event listeners - use CAPTURE phase to catch events early
    // This ensures handlers work even if child elements stop propagation
    cardElement.addEventListener('pointerdown', pointerDownHandler, true);
    cardElement.addEventListener('pointermove', pointerMoveHandler, true);
    cardElement.addEventListener('pointerup', pointerUpHandler, true);
    cardElement.addEventListener('pointercancel', pointerCancelHandler, true);
    cardElement.addEventListener('click', clickHandler, true);
    cardElement.addEventListener('contextmenu', contextMenuHandler, true);
    cardElement.addEventListener('selectstart', selectStartHandler, true); // CAPTURE phase
    cardElement.addEventListener('dragstart', dragStartHandler, true);
    cardElement.addEventListener('mousedown', mouseDownHandler, true); // Also catch mousedown
    cardElement.addEventListener('touchstart', touchStartHandler, { capture: true, passive: false });
    cardElement.addEventListener('touchmove', touchMoveHandler, true);
    cardElement.addEventListener('touchend', touchEndHandler, { capture: true, passive: false });
    cardElement.addEventListener('touchcancel', touchCancelHandler, { capture: true, passive: false });

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
      cardElement.removeEventListener('touchstart', touchStartHandler, true);
      cardElement.removeEventListener('touchmove', touchMoveHandler, true);
      cardElement.removeEventListener('touchend', touchEndHandler, true);
      cardElement.removeEventListener('touchcancel', touchCancelHandler, true);
      
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
      cardElement.classList.remove('context-menu-pressing');
      if (cardElementRef.current === cardElement) {
        cardElementRef.current = null;
      }
    };
  }, [disabled, resetLongPress]);

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
        onOpenChange={(open) => {
          isMenuOpenRef.current = open; // Track menu open state
          if (!open) {
            resetLongPress();
            if (cardElementRef.current) {
              cardElementRef.current.classList.remove('context-menu-pressing');
            }
            // Add a small delay before allowing card clicks again
            setTimeout(() => {
              isMenuOpenRef.current = false;
            }, 100);
          }
        }}
      >
        <div style={{ display: "none" }} />
      </CenteredContextMenu>
    </>
  );
}
