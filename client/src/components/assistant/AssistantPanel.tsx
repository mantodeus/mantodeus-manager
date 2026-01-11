/**
 * Assistant Panel Component (Mobile Bottom Sheet)
 * 
 * PWA-SPECIFIC NOTES:
 * - PWA WebViews report viewport height differently than browsers
 * - We use visualViewport API for accurate measurements when available
 * - Scroll locking must be aggressive (body + html + touch prevention)
 * - Safe area handling differs in standalone mode
 * 
 * Mobile behavior:
 * - Fixed overlay sitting ABOVE the bottom tab bar (never behind it)
 * - Three snap states: collapsed (last message line only), mid (50%), full
 * - Page scroll is hard-locked when chat is open
 * - Chat scroll is completely isolated
 * - Font size 16px to prevent iOS zoom on focus
 * 
 * Desktop: Side panel (unchanged)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, X, Send, BugAnt, HelpCircle, ChevronLeft, ChevronRight, CheckCircle2 } from "@/components/ui/Icon";
import { useIsMobile } from "@/hooks/useMobile";
import { useManto } from "@/contexts/MantoContext";
import { cn } from "@/lib/utils";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGuidance, type TourStep, type GuidanceWarning } from "@/contexts/GuidanceContext";
import type { MantoMessage } from "@/contexts/MantoContext";

// Bottom tab bar height (h-14 = 56px) - must match BottomTabBar.tsx
const TAB_BAR_HEIGHT = 56;

// Collapsed state: drag handle (24px) + preview text line (20px) + padding (16px)
const COLLAPSED_HEIGHT = 60;

// Snap point type
type SnapState = "collapsed" | "mid" | "full";

// Heights for each snap state
interface SnapHeights {
  collapsed: number;
  mid: number;
  full: number;
}

export type AssistantScope = "invoice_detail" | "general";

interface AssistantPanelProps {
  scope: AssistantScope;
  scopeId?: number;
  pageName?: string;
  onAction?: (action: "OPEN_SHARE" | "OPEN_ADD_PAYMENT" | "OPEN_EDIT_DUE_DATE" | "OPEN_REVERT_STATUS") => void;
}

interface AssistantResponse {
  answerMarkdown: string;
  confidence: "low" | "medium" | "high";
  steps?: TourStep[];
  warnings?: GuidanceWarning[];
}

const INVOICE_PROMPTS = [
  "Why can't I send this?",
  "What's blocking this invoice?",
  "How do I mark it paid?",
];

const GENERAL_PROMPTS = [
  "How do I create an invoice?",
  "How do I add a new project?",
  "How do I scan a receipt?",
];

/**
 * Compute snap heights based on viewport
 * Using simple window.innerHeight - more reliable across browsers and PWA
 */
function computeSnapHeights(vhOverride?: number): SnapHeights {
  const vh =
    typeof window !== "undefined"
      ? (vhOverride ?? window.innerHeight)
      : 800;
  
  // Get safe area inset top (for status bar in PWA)
  // CSS env() isn't directly accessible in JS, so we read it from a temp element
  let safeAreaTop = 0;
  if (typeof document !== 'undefined') {
    const testEl = document.createElement('div');
    testEl.style.paddingTop = 'env(safe-area-inset-top)';
    document.body.appendChild(testEl);
    safeAreaTop = parseInt(getComputedStyle(testEl).paddingTop) || 0;
    document.body.removeChild(testEl);
  }
  
  // Available height = full viewport minus tab bar
  const availableHeight = vh - TAB_BAR_HEIGHT;
  
  return {
    collapsed: COLLAPSED_HEIGHT,
    mid: Math.round(availableHeight * 0.5),
    // Full height: leave room for status bar (safe area top) + generous margin
    // to avoid conflict with iOS swipe-down gesture from top
    full: availableHeight - safeAreaTop - 44,
  };
}

export function AssistantPanel({
  scope,
  scopeId,
  pageName = "Mantodeus",
  onAction,
}: AssistantPanelProps) {
  const { isOpen, closeManto, messages, addMessage, clearMessages } = useManto();
  const isMobile = useIsMobile();
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Snap state management
  const [snapState, setSnapState] = useState<SnapState>("mid");
  const [snapHeights, setSnapHeights] = useState<SnapHeights>(computeSnapHeights);
  const [currentHeight, setCurrentHeight] = useState<number>(() => computeSnapHeights().mid);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const defaultPrompts = scope === "invoice_detail" ? INVOICE_PROMPTS : GENERAL_PROMPTS;
  
  const { 
    startTour,
    cancelTour,
    nextStep,
    previousStep,
    getVisibleElements,
    tourStatus,
    currentStep,
    currentStepIndex,
    totalSteps,
    activeWarnings,
  } = useGuidance();

  const isTourActive = tourStatus === "active";
  const isTourPaused = tourStatus === "paused";
  const isTourComplete = tourStatus === "complete";

  // Recompute snap heights on viewport changes
  useEffect(() => {
    if (!isMobile) return;
    
    // iOS Safari frequently fires many small resize events while scrolling (URL bar show/hide),
    // which can cause the sheet to "jump" as we re-snap heights.
    // Only react to "real" resizes (keyboard open/close, orientation/width change).
    const IGNORE_SMALL_RESIZE_PX = 120;
    const lastAppliedViewport = { vh: 0, vw: 0, initialized: false };
    let decisionLogCount = 0;

    const updateHeights = () => {
      const vv = window.visualViewport;
      const vh = vv?.height ?? window.innerHeight;
      const vw = vv?.width ?? window.innerWidth;

      const isFirst = !lastAppliedViewport.initialized;
      const widthChanged = !isFirst && Math.abs(vw - lastAppliedViewport.vw) > 1;
      const heightDelta = isFirst ? 9999 : Math.abs(vh - lastAppliedViewport.vh);
      const shouldApply = isFirst || widthChanged || heightDelta >= IGNORE_SMALL_RESIZE_PX;

      if (!shouldApply) {
        if (decisionLogCount < 4) {
          decisionLogCount++;
          // #region agent log
          fetch("/api/debug/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "AssistantPanel.tsx:resizeGuard",
              message: "ignored small viewport resize",
              data: {
                snapState,
                isDragging,
                vh,
                vw,
                prevVh: lastAppliedViewport.vh,
                prevVw: lastAppliedViewport.vw,
                heightDelta,
                widthChanged,
                threshold: IGNORE_SMALL_RESIZE_PX,
              },
              timestamp: Date.now(),
              sessionId: "debug-session",
              hypothesisId: "H3",
              runId: "manto-chrome-resize-1",
            }),
          }).catch(() => {});
          // #endregion
        }
        return;
      }

      lastAppliedViewport.initialized = true;
      lastAppliedViewport.vh = vh;
      lastAppliedViewport.vw = vw;

      const newHeights = computeSnapHeights(vh);
      setSnapHeights(newHeights);
      if (!isDragging) setCurrentHeight(newHeights[snapState]);
    };
    
    // Initial computation
    updateHeights();
    
    window.addEventListener('resize', updateHeights);
    window.addEventListener('orientationchange', updateHeights);
    
    return () => {
      window.removeEventListener('resize', updateHeights);
      window.removeEventListener('orientationchange', updateHeights);
    };
  }, [isMobile, snapState, isDragging]);

  // Update height when snap state changes
  useEffect(() => {
    if (!isMobile || isDragging) return;
    setCurrentHeight(snapHeights[snapState]);
  }, [snapState, snapHeights, isMobile, isDragging]);

  // Ensure page behind can scroll past the open sheet by increasing app-content bottom padding
  // via a CSS variable consumed in `index.css`.
  useEffect(() => {
    if (!isMobile) return;
    const root = document.documentElement;
    const isSheetCoveringPage = isOpen && snapState !== "collapsed";
    root.style.setProperty(
      "--manto-sheet-height",
      isSheetCoveringPage ? `${currentHeight}px` : "0px"
    );
    return () => {
      root.style.removeProperty("--manto-sheet-height");
    };
  }, [isMobile, isOpen, snapState, currentHeight]);

  // Debug: verify whether page bottom is covered by the chat sheet on mobile.
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    let logCount = 0;
    const appContent = document.querySelector(".app-content") as HTMLElement | null;
    const vv = window.visualViewport;
    let resizeLogCount = 0;

    const log = (message: string, data: Record<string, unknown>) => {
      // #region agent log
      fetch("/api/debug/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "AssistantPanel.tsx:pageBehindChat",
          message,
          data,
          timestamp: Date.now(),
          sessionId: "debug-session",
          hypothesisId: "H1,H2",
          runId: "manto-page-bottom-1",
        }),
      }).catch(() => {});
      // #endregion
    };

    const logVars = (reason: string) => {
      // #region agent log
      try {
        const rootCs = getComputedStyle(document.documentElement);
        const appLastDiv = appContent?.querySelector("div:last-child") as HTMLElement | null;
        const appLastDivCs = appLastDiv ? getComputedStyle(appLastDiv) : null;
        log("vars", {
          reason,
          rootBottomSafeArea: rootCs.getPropertyValue("--bottom-safe-area")?.trim(),
          rootMantoSheetHeight: rootCs.getPropertyValue("--manto-sheet-height")?.trim(),
          appPadBottom: appContent ? getComputedStyle(appContent).paddingBottom : null,
          appLastDivPadBottom: appLastDivCs?.paddingBottom ?? null,
          displayModeStandalone: window.matchMedia?.("(display-mode: standalone)")?.matches ?? null,
          navigatorStandalone: (window.navigator as any).standalone ?? null,
        });
      } catch {}
      // #endregion
    };

    const snapshot = (reason: string) => {
      const sheetEl = sheetRef.current;
      const sheetRect = sheetEl?.getBoundingClientRect();
      const cs = appContent ? getComputedStyle(appContent) : null;
      log("snapshot", {
        reason,
        snapState,
        currentHeight,
        innerHeight: window.innerHeight,
        vvH: vv?.height,
        vvOffsetTop: vv?.offsetTop,
        appExists: !!appContent,
        appClientH: appContent?.clientHeight,
        appScrollH: appContent?.scrollHeight,
        appScrollTop: appContent?.scrollTop,
        appPadBottom: cs?.paddingBottom,
        sheetTop: sheetRect ? Math.round(sheetRect.top) : null,
        sheetHeight: sheetRect ? Math.round(sheetRect.height) : null,
      });
      logVars(`snapshot:${reason}`);
    };

    const onScroll = () => {
      if (!appContent) return;
      if (logCount >= 4) return;
      const nearBottom =
        appContent.scrollTop + appContent.clientHeight >= appContent.scrollHeight - 2;
      if (!nearBottom) return;
      logCount++;

      const sheetEl = sheetRef.current;
      const sheetRect = sheetEl?.getBoundingClientRect();
      const cs = getComputedStyle(appContent);
      const lastEl = appContent.lastElementChild as HTMLElement | null;
      const lastRect = lastEl?.getBoundingClientRect();
      log("app-content scrolled near bottom", {
        snapState,
        currentHeight,
        appClientH: appContent.clientHeight,
        appScrollH: appContent.scrollHeight,
        appScrollTop: appContent.scrollTop,
        appPadBottom: cs.paddingBottom,
        sheetTop: sheetRect ? Math.round(sheetRect.top) : null,
        sheetHeight: sheetRect ? Math.round(sheetRect.height) : null,
        lastElTag: lastEl?.tagName ?? null,
        lastElBottom: lastRect ? Math.round(lastRect.bottom) : null,
        gapAboveSheet: sheetRect && lastRect ? Math.round(sheetRect.top - lastRect.bottom) : null,
        coveredBySheet: sheetRect
          ? Math.round(appContent.getBoundingClientRect().bottom) > Math.round(sheetRect.top)
          : null,
      });
      logVars("scroll:near-bottom");
    };

    const onViewportResize = () => {
      if (resizeLogCount >= 6) return;
      resizeLogCount++;
      log("viewport resize", {
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        vvH: vv?.height,
        vvOffsetTop: vv?.offsetTop,
        snapState,
        currentHeight,
      });
      logVars("viewport-resize");
    };

    snapshot("effect-mount");
    appContent?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onViewportResize, { passive: true } as any);
    vv?.addEventListener("resize", onViewportResize, { passive: true } as any);

    return () => {
      appContent?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onViewportResize, { passive: true } as any);
      vv?.removeEventListener("resize", onViewportResize as any);
      snapshot("effect-unmount");
    };
  }, [isMobile, isOpen, snapState, currentHeight]);

  // Lock page scroll when chat is open (PWA-compatible)
  // We rely on sheet-level handlers + CSS overscroll-behavior instead of document-level blocking
  // This allows page scroll when chat is closed and messages scroll when chat is open

  // Direct event listener on the sheet element (blocks scroll on non-messages areas)
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;

    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as Node;
      const scrollEl = messagesContainerRef.current;
      
      // If messages container exists and contains the target, let it scroll freely
      if (scrollEl && scrollEl.contains(target)) {
        // Allow normal scrolling - CSS overscroll-behavior: contain handles scroll chaining
        return;
      }
      
      // For all other areas of the panel (header, input, drag handle), block scroll
      e.preventDefault();
    };

    sheetEl.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      sheetEl.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isMobile, isOpen]);

  // Native event listener on messages container to prevent scroll chaining ONLY at edges.
  // Must attach after the messages container exists (when snapState !== 'collapsed').
  // Note: We use snapState directly here instead of showFullMessages to avoid TDZ error
  // (showFullMessages is declared later in the component).
  useEffect(() => {
    const showMessages = snapState !== 'collapsed';
    if (!isMobile || !isOpen || !showMessages) return;
    
    const attach = () => {
      const messagesEl = messagesContainerRef.current;
      if (!messagesEl) return false;

      let lastY = 0;
      let lastScrollTop = 0;

      const handleTouchStart = (e: TouchEvent) => {
        lastY = e.touches[0]?.clientY ?? 0;
        lastScrollTop = messagesEl.scrollTop;
      };

      const handleTouchMove = (e: TouchEvent) => {
        const { scrollTop, scrollHeight, clientHeight } = messagesEl;
        const cantScroll = scrollHeight <= clientHeight + 1;
        
        // If can't scroll, prevent page scroll
        if (cantScroll) {
          e.preventDefault();
          return;
        }
        
        const y = e.touches[0]?.clientY ?? lastY;
        const dy = y - lastY; // dy > 0 = finger moving down (scroll content up)
        const scrollDelta = scrollTop - lastScrollTop;
        
        // Only prevent if we're at an edge AND trying to scroll beyond it (rubber-band)
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
        
        // At top: prevent if trying to scroll up (dy > 0 means finger down = scroll up = beyond top)
        // At bottom: prevent if trying to scroll down (dy < 0 means finger up = scroll down = beyond bottom)
        // BUT: only if scrollTop didn't actually change (means we're stuck at edge)
        if (atTop && dy > 0 && scrollDelta === 0) {
          e.preventDefault();
        } else if (atBottom && dy < 0 && scrollDelta === 0) {
          e.preventDefault();
        }
        
        lastY = y;
        lastScrollTop = scrollTop;
      };

      messagesEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      messagesEl.addEventListener('touchmove', handleTouchMove, { passive: false });

      return () => {
        messagesEl.removeEventListener('touchstart', handleTouchStart);
        messagesEl.removeEventListener('touchmove', handleTouchMove);
      };
    };

    const cleanup = attach();
    if (cleanup) return cleanup;

    // If not attached yet (element not ready), retry on next frame
    let rafId = requestAnimationFrame(() => attach());
    return () => cancelAnimationFrame(rafId);
  }, [isMobile, isOpen, snapState]);

  // Drag handling
  const handleDragStart = useCallback((e: React.TouchEvent | React.PointerEvent | React.MouseEvent) => {
    if (!isMobile) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = currentHeight;
    setIsDragging(true);
  }, [isMobile, currentHeight]);

  const handleDragMove = useCallback((e: React.TouchEvent | React.PointerEvent | React.MouseEvent) => {
    if (!isDragging || !isMobile) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    const deltaY = dragStartY.current - clientY; // Positive = dragging up
    const newHeight = dragStartHeight.current + deltaY;
    
    // Clamp to min/max
    const clamped = Math.max(snapHeights.collapsed, Math.min(snapHeights.full, newHeight));
    setCurrentHeight(clamped);
  }, [isDragging, isMobile, snapHeights]);

  const handleDragEnd = useCallback((e?: React.TouchEvent | React.PointerEvent | React.MouseEvent) => {
    if (!isDragging || !isMobile) return;
    
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    setIsDragging(false);
    
    // Snap to nearest point
    const distances = [
      { state: 'collapsed' as SnapState, dist: Math.abs(currentHeight - snapHeights.collapsed) },
      { state: 'mid' as SnapState, dist: Math.abs(currentHeight - snapHeights.mid) },
      { state: 'full' as SnapState, dist: Math.abs(currentHeight - snapHeights.full) },
    ];
    distances.sort((a, b) => a.dist - b.dist);
    setSnapState(distances[0].state);
  }, [isDragging, isMobile, currentHeight, snapHeights]);

  // Handle tap to toggle between states
  const handleHandleTap = useCallback((e: React.MouseEvent) => {
    if (!isMobile || isDragging) return;
    
    e.stopPropagation();
    
    // Toggle: collapsed -> mid, mid -> full, full -> mid
    setSnapState(prev => {
      if (prev === 'collapsed') return 'mid';
      if (prev === 'mid') return 'full';
      return 'mid';
    });
  }, [isMobile, isDragging]);

  // Mutation for AI chat
  const askMutation = trpc.ai.ask.useMutation({
    onSuccess: (response: AssistantResponse) => {
      addMessage({
        role: "assistant",
        content: response.answerMarkdown,
      });
      setIsLoading(false);
      
      if (response.steps && response.steps.length > 0) {
        startTour({
          steps: response.steps,
          warnings: response.warnings,
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to get response");
      setIsLoading(false);
    },
  });
  
  // Clear tour when panel closes
  useEffect(() => {
    if (!isOpen) {
      cancelTour();
    }
  }, [isOpen, cancelTour]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Focus input after a short delay (not in collapsed state)
      if (snapState !== 'collapsed') {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    }
  }, [isOpen, messages, snapState]);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    cancelTour();

    addMessage({
      role: "user",
      content: trimmed,
    });
    setInputValue("");
    setIsLoading(true);

    // Expand to mid if collapsed
    if (snapState === 'collapsed') {
      setSnapState('mid');
    }

    try {
      await askMutation.mutateAsync({
        scope,
        scopeId: scopeId ?? undefined,
        message: trimmed,
        visibleElements: getVisibleElements(),
      });
    } catch {
      // Error handled in onError
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => {
      cancelTour();
      
      addMessage({
        role: "user",
        content: prompt,
      });
      setInputValue("");
      setIsLoading(true);
      askMutation.mutate({
        scope,
        scopeId: scopeId ?? undefined,
        message: prompt,
        visibleElements: getVisibleElements(),
      });
    }, 50);
  };

  const handleCancelTour = () => {
    cancelTour();
  };

  const handleClearAndAskNew = () => {
    cancelTour();
    clearMessages();
  };

  if (!isOpen) return null;

  // Determine what to show based on snap state
  const showHeader = snapState !== 'collapsed';
  const showTourUI = showHeader && (isTourActive || isTourPaused || isTourComplete);
  const showInput = showHeader && !isTourActive && !isTourPaused;
  const showFullMessages = snapState !== 'collapsed';

  // Get last message for collapsed preview
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

  return (
    <>
      {/* Overlay - allows tap to close, but scroll blocking handled by document-level handler */}
      {/* Desktop: visible backdrop; Mobile: invisible */}
      <div
        className={cn(
          "fixed inset-0 z-[499]", // Just below the panel (z-500)
          // Mobile: don't intercept taps/scrolls; user can interact with the page behind.
          isMobile
            ? "bg-transparent pointer-events-none"
            : "bg-transparent pointer-events-none"
        )}
        onClick={undefined}
        aria-hidden="true"
      />

      {/* Chat Panel */}
      <div
        ref={sheetRef}
        className={cn(
          "fixed flex flex-col bg-background",
          isMobile ? [
            "z-[500]", // Below ModuleScroller (1000) and tab bar (9999)
            "left-0 right-0",
            "rounded-t-2xl",
            "border-t border-l border-r border-border/50",
            !isDragging && "transition-[height] duration-200 ease-out",
          ] : [
            "z-[100]",
            "shadow-xl border-r border-border",
            "animate-in slide-in-from-left fade-in duration-300",
            "left-0 top-0 bottom-0",
            "w-[420px]",
          ]
        )}
        style={isMobile ? {
          // Position using CSS variable (single source of truth)
          bottom: 'var(--bottom-safe-area)',
          height: `${currentHeight}px`,
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          // Note: touchAction is set per-child, not on container, to allow messages scroll
          // Prevent scroll chaining to the page
          overscrollBehavior: 'contain',
        } : undefined}
        // Touch events handled via native listeners in useEffect (passive: false required)
      >
        {/* Drag Handle - always visible on mobile */}
        {isMobile && (
          <div
            className="flex justify-center items-center h-6 cursor-grab active:cursor-grabbing shrink-0"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
            onTouchCancel={handleDragEnd}
            onClick={handleHandleTap}
            style={{ touchAction: 'none' }}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
          </div>
        )}

        {/* Collapsed state: show only last message preview (visible!) */}
        {snapState === 'collapsed' && (
          <div className="px-4 pb-2 shrink-0 min-h-[28px]">
            {lastMessage ? (
              <p className="text-sm text-muted-foreground truncate leading-5">
                {lastMessage.role === 'assistant' ? '🤖 ' : '💬 '}
                {lastMessage.content.slice(0, 60)}
                {lastMessage.content.length > 60 ? '...' : ''}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60 leading-5">
                Tap to open chat
              </p>
            )}
          </div>
        )}

        {/* Header - hidden in collapsed */}
        {showHeader && (
          <div className={cn(
            "flex items-center justify-between px-4 border-b border-border/30 shrink-0",
            isMobile ? "py-2" : "py-3"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <BugAnt className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Manto</h2>
                  {isTourActive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-medium">
                      Step {currentStepIndex + 1}/{totalSteps}
                    </span>
                  )}
                  {isTourPaused && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-[10px] text-amber-600 font-medium">
                      Paused
                    </span>
                  )}
                  {isTourComplete && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-500/10 text-[10px] text-green-600 font-medium">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Done
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[200px] text-xs z-[10003]">
                  <p>Powered by Mistral, a European AI company.</p>
                  <p className="mt-1 text-muted-foreground">Your data stays yours - we don't train models on it.</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeManto}
                className="h-7 w-7 rounded-lg hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Tour UI - hidden in collapsed */}
        {showTourUI && (
          <>
            {(isTourActive || isTourPaused) && currentStep && (
              <div className="px-4 py-3 border-b border-border/50 bg-primary/5 shrink-0">
                <p className="text-sm font-medium mb-3">{currentStep.description}</p>
                
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={previousStep}
                    disabled={currentStepIndex === 0}
                    className="h-8 text-xs gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </Button>
                  
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          i === currentStepIndex ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      />
                    ))}
                  </div>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={nextStep}
                    className="h-8 text-xs gap-1"
                  >
                    {currentStepIndex === totalSteps - 1 ? "Finish" : "Next"}
                    {currentStepIndex < totalSteps - 1 && <ChevronRight className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                
                <div className="mt-2 text-center">
                  <button
                    onClick={handleCancelTour}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel guide
                  </button>
                </div>
              </div>
            )}

            {isTourComplete && (
              <div className="px-4 py-4 border-b border-border/50 bg-green-500/5 text-center shrink-0">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-600">All done!</p>
                <p className="text-xs text-muted-foreground mt-1">Ask another question or close</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAndAskNew}
                  className="mt-3 h-7 text-xs"
                >
                  Clear & Ask New Question
                </Button>
              </div>
            )}

            {activeWarnings && activeWarnings.length > 0 && (isTourActive || isTourPaused) && (
              <div className="px-4 py-2 border-b border-border/50 bg-amber-500/5 shrink-0">
                {activeWarnings.map((warning, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                    <span className="shrink-0">⚠️</span>
                    <span>{warning.message}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}

        {/* Messages - only in mid/full states */}
        {showFullMessages && (
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
            style={{
              // CRITICAL: Prevent scroll chaining (PWA fix)
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              // Allow vertical scroll only within this container
              touchAction: 'pan-y',
            }}
            onTouchStart={(e) => {
              // iOS PWA edge-nudge: prevents scroll chaining by ensuring we're never exactly at 0 / max.
              const el = messagesContainerRef.current;
              if (el) {
                const atTop = el.scrollTop <= 0;
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight;
                if (atTop) el.scrollTop = 1;
                else if (atBottom) el.scrollTop = Math.max(0, el.scrollTop - 1);
              }
            }}
            onWheel={(e) => {
              // Stop wheel events from reaching page
              e.stopPropagation();
            }}
          >
            {messages.length === 0 && !isTourActive && !isTourComplete && (
              <div className="space-y-3 py-2">
                <div className="flex items-start gap-2.5">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                    <BugAnt className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="space-y-2 pt-0.5">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {scope === "invoice_detail" 
                        ? "Ask about this invoice."
                        : "Ask a question."}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {defaultPrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleQuickPrompt(prompt)}
                          className={cn(
                            "px-2.5 py-1.5 text-xs rounded-lg",
                            "bg-muted/50 hover:bg-muted",
                            "text-muted-foreground hover:text-foreground",
                            "border border-border/50 hover:border-border",
                            "transition-all duration-150"
                          )}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2.5",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                    <BugAnt className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="text-sm prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                      <SimpleMarkdown>{message.content}</SimpleMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                  <BugAnt className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/60 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input - only in mid/full, not during tour */}
        {showInput && (
          <div className={cn(
            "px-4 border-t border-border/30 shrink-0",
            isMobile ? "py-3" : "py-3"
          )}>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything..."
                disabled={isLoading}
                data-hide-tabbar-when-keyboard="true"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className={cn(
                  "flex-1 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary/50",
                  // 16px font size prevents iOS zoom on focus (PWA critical)
                  isMobile ? "h-11 text-[16px] leading-normal" : "h-9 text-sm"
                )}
                style={isMobile ? { 
                  fontSize: '16px',
                  // Prevent zoom/scale on focus in PWA
                  transform: 'translateZ(0)',
                } : undefined}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                size="icon"
                className={cn(
                  "rounded-xl shrink-0",
                  isMobile ? "h-11 w-11" : "h-9 w-9"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
