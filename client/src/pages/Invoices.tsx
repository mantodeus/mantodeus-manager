import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Loader2, Upload, DocumentCurrencyEuro, DocumentCurrencyPound, Search, SlidersHorizontal, Settings, X, CheckCircle2, Archive, Trash2 } from "@/components/ui/Icon";
import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { getInvoiceActions, isActionValidForInvoice } from "@/lib/invoiceActions";
import { getAccountingDate, getAccountingHelperText } from "@/lib/accountingDate";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { MarkAsSentWarningDialog } from "@/components/MarkAsSentWarningDialog";
import { MarkAsPaidDialog } from "@/components/invoices/MarkAsPaidDialog";
import { useIsMobile } from "@/hooks/useMobile";
import { useLongPress } from "@/hooks/useLongPress";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { Link, useLocation } from "wouter";
import { MultiSelectBar, createArchiveAction, createDeleteAction } from "@/components/MultiSelectBar";
import { BulkInvoiceUploadDialog } from "@/components/invoices/BulkInvoiceUploadDialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

type FilterState = {
  project: string;
  client: string;
  time: string; // "all" | "2024" | "2024-10" (year-month format)
  status: "active" | "archived" | "deleted" | "all";
};

const defaultFilters: FilterState = {
  project: "all",
  client: "all",
  time: "all",
  status: "active",
};

// Month names for date search and display
const monthNames = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const monthDisplayNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Year Total Card Component with Long Press
function YearTotalCard({ 
  selectedYear, 
  yearPaid, 
  yearDue,
  allYearTotals, 
  onYearSelect,
  popoverOpen,
  onPopoverOpenChange 
}: { 
  selectedYear: number;
  yearPaid: number;
  yearDue: number;
  allYearTotals: Array<{ year: number; paid: number; due: number; total: number }>;
  onYearSelect: (year: number) => void;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const [viewMode, setViewMode] = useState<'total' | 'paid-due'>('paid-due');
  
  const yearTotal = yearPaid + yearDue;
  
  const { longPressHandlers, reset: resetLongPress, gestureState } = useLongPress({
    onLongPress: (e) => {
      e.preventDefault();
      if (cardRef.current) {
        setCardRect(cardRef.current.getBoundingClientRect());
        cardRef.current.classList.remove('context-menu-pressing');
      }
      onPopoverOpenChange(true);
    },
    onPressStart: () => {
      if (cardRef.current) {
        cardRef.current.classList.add('context-menu-pressing');
      }
    },
    duration: 550,
  });

  // Reset long press when menu closes
  useEffect(() => {
    if (!popoverOpen) {
      resetLongPress();
    }
  }, [popoverOpen, resetLongPress]);

  // Remove pressing class when press ends or menu opens
  useEffect(() => {
    if (cardRef.current) {
      if (gestureState === 'idle' || gestureState === 'menu-open') {
        cardRef.current.classList.remove('context-menu-pressing');
      }
    }
  }, [gestureState]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    }
    onPopoverOpenChange(true);
  };

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (!popoverOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTop = document.body.style.top;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && (menuRef.current.contains(target) || menuRef.current === target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && (menuRef.current.contains(target) || menuRef.current === target)) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    document.body.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    document.body.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.top = originalBodyTop;
      window.scrollTo(0, scrollY);
      window.removeEventListener('wheel', preventScroll, { capture: true } as any);
      window.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      document.body.removeEventListener('wheel', preventScroll, { capture: true } as any);
      document.body.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
    };
  }, [popoverOpen]);

  // Calculate menu position
  const menuStyle = useMemo(() => {
    if (!cardRect) return null;
    
    return {
      position: 'fixed' as const,
      left: `${cardRect.left}px`,
      top: `${cardRect.bottom + 8}px`,
      width: `${cardRect.width}px`,
      minWidth: `${cardRect.width}px`,
    };
  }, [cardRect]);

  // Show all years with data OR the current year (even if 0 total), sorted by year descending
  const currentYear = new Date().getFullYear();
  const availableYears = [...allYearTotals]
    .filter(({ year, total }) => total > 0 || year === currentYear)
    .sort((a, b) => b.year - a.year);

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "p-4 has-context-menu cursor-pointer min-h-[86px] card-hover-polish summary-card-permanent-hover",
          popoverOpen && "context-menu-active"
        )}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
      >
        <div 
          className="flex flex-col gap-1"
          onClick={(e) => {
            e.stopPropagation();
            setViewMode(viewMode === 'total' ? 'paid-due' : 'total');
          }}
        >
          {viewMode === 'total' ? (
            <div className="flex items-center justify-between">
              <span className="text-xs font-light text-muted-foreground uppercase tracking-wide">
                Total {selectedYear}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-light tabular-nums">
                  {formatCurrency(yearTotal)}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-muted-foreground uppercase tracking-wide">
                  Total {selectedYear}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-light tabular-nums">
                    {formatCurrency(yearPaid)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">Due</span>
                <span className="text-sm font-light tabular-nums text-muted-foreground">
                  {formatCurrency(yearDue)}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {popoverOpen && cardRect && menuStyle && createPortal(
        <>
          {/* Background blur layer */}
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
              touchAction: "none",
            }}
            onClick={() => onPopoverOpenChange(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            className="glass-context-menu"
            style={{
              ...menuStyle,
              zIndex: 9998,
              animation: "slideDownMenu 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              pointerEvents: "auto",
              maxHeight: "300px",
              minHeight: "40px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="space-y-1 w-full py-1">
              {/* All available years */}
              {availableYears.length > 0 ? (
                availableYears.map(({ year, total }) => (
                  <button
                    key={year}
                    onClick={() => {
                      onYearSelect(year);
                      onPopoverOpenChange(false);
                    }}
                    className="glass-menu-item w-full text-left flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors"
                    style={{ border: 'none', color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    <span className="text-sm font-light" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Total {year}</span>
                    <span className="text-sm font-light tabular-nums" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{formatCurrency(total)}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">No years available</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Quarter Total Card Component with Long Press
function QuarterTotalCard({ 
  selectedQuarter, 
  quarterPaid,
  quarterDue,
  allQuarterTotals, 
  onQuarterSelect,
  popoverOpen,
  onPopoverOpenChange 
}: { 
  selectedQuarter: { quarter: number; year: number };
  quarterPaid: number;
  quarterDue: number;
  allQuarterTotals: Array<{ key: string; quarter: number; year: number; paid: number; due: number; total: number }>;
  onQuarterSelect: (quarter: number, year: number) => void;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const [viewMode, setViewMode] = useState<'total' | 'paid-due'>('paid-due');
  
  const quarterTotal = quarterPaid + quarterDue;
  
  const { longPressHandlers, reset: resetLongPress, gestureState } = useLongPress({
    onLongPress: (e) => {
      e.preventDefault();
      if (cardRef.current) {
        setCardRect(cardRef.current.getBoundingClientRect());
        cardRef.current.classList.remove('context-menu-pressing');
      }
      onPopoverOpenChange(true);
    },
    onPressStart: () => {
      if (cardRef.current) {
        cardRef.current.classList.add('context-menu-pressing');
      }
    },
    duration: 550,
  });

  // Reset long press when menu closes
  useEffect(() => {
    if (!popoverOpen) {
      resetLongPress();
    }
  }, [popoverOpen, resetLongPress]);

  // Remove pressing class when press ends or menu opens
  useEffect(() => {
    if (cardRef.current) {
      if (gestureState === 'idle' || gestureState === 'menu-open') {
        cardRef.current.classList.remove('context-menu-pressing');
      }
    }
  }, [gestureState]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    }
    onPopoverOpenChange(true);
  };

  // Prevent background scrolling when menu is open
  useEffect(() => {
    if (!popoverOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyWidth = document.body.style.width;
    const originalBodyTop = document.body.style.top;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && (menuRef.current.contains(target) || menuRef.current === target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (menuRef.current && (menuRef.current.contains(target) || menuRef.current === target)) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    window.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });
    document.body.addEventListener('wheel', preventScroll, { passive: false, capture: true });
    document.body.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.width = originalBodyWidth;
      document.body.style.top = originalBodyTop;
      window.scrollTo(0, scrollY);
      window.removeEventListener('wheel', preventScroll, { capture: true } as any);
      window.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
      document.body.removeEventListener('wheel', preventScroll, { capture: true } as any);
      document.body.removeEventListener('touchmove', preventTouchMove, { capture: true } as any);
    };
  }, [popoverOpen]);

  // Calculate menu position
  const menuStyle = useMemo(() => {
    if (!cardRect) return null;
    
    return {
      position: 'fixed' as const,
      left: `${cardRect.left}px`,
      top: `${cardRect.bottom + 8}px`,
      width: `${cardRect.width}px`,
      minWidth: `${cardRect.width}px`,
    };
  }, [cardRect]);

  // Show all quarters with data OR the current quarter (even if 0 total), sorted by year and quarter descending
  const currentDate = new Date();
  const currentQuarterYear = currentDate.getFullYear();
  const currentQuarterNum = Math.floor(currentDate.getMonth() / 3) + 1;
  const availableQuarters = [...allQuarterTotals]
    .filter(({ year, quarter, total }) => total > 0 || (year === currentQuarterYear && quarter === currentQuarterNum))
    .sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.quarter - a.quarter;
    });

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "p-4 has-context-menu cursor-pointer min-h-[86px] card-hover-polish summary-card-permanent-hover",
          popoverOpen && "context-menu-active"
        )}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
      >
        <div 
          className="flex flex-col gap-1"
          onClick={(e) => {
            // Only toggle if menu is not open and it's a regular click (not long press)
            if (!popoverOpen) {
              e.stopPropagation();
              setViewMode(viewMode === 'total' ? 'paid-due' : 'total');
            }
          }}
        >
          {viewMode === 'total' ? (
            <div className="flex items-center justify-between">
              <span className="text-xs font-light text-muted-foreground uppercase tracking-wide">
                Q{selectedQuarter.quarter} {selectedQuarter.year}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-light tabular-nums">
                  {formatCurrency(quarterTotal)}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-light text-muted-foreground uppercase tracking-wide">
                  Q{selectedQuarter.quarter} {selectedQuarter.year}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-light tabular-nums">
                    {formatCurrency(quarterPaid)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">Due</span>
                <span className="text-sm font-light tabular-nums text-muted-foreground">
                  {formatCurrency(quarterDue)}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {popoverOpen && cardRect && menuStyle && createPortal(
        <>
          {/* Background blur layer */}
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
              touchAction: "none",
            }}
            onClick={() => onPopoverOpenChange(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            className="glass-context-menu"
            style={{
              ...menuStyle,
              zIndex: 9998,
              animation: "slideDownMenu 200ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              pointerEvents: "auto",
              maxHeight: "300px",
              minHeight: "40px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="space-y-1 w-full py-1">
              {/* All available quarters */}
              {availableQuarters.length > 0 ? (
                availableQuarters.map(({ key, quarter, year, total }) => (
                  <button
                    key={key}
                    onClick={() => {
                      onQuarterSelect(quarter, year);
                      onPopoverOpenChange(false);
                    }}
                    className="glass-menu-item w-full text-left flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors"
                    style={{ border: 'none', color: 'rgba(255, 255, 255, 0.9)' }}
                  >
                    <span className="text-sm font-light" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{key}</span>
                    <span className="text-sm font-light tabular-nums" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{formatCurrency(total)}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">No quarters available</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export default function Invoices() {
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const isDarkMode = theme === 'green-mantis';
  
  // Scroll state for compact header (desktop only)
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    if (isMobile) return;
    
    // Find the scroll container (main element with app-content class)
    const findScrollContainer = () => {
      const main = document.querySelector('main.app-content[data-layout="content-column"]');
      return main as HTMLElement | null;
    };
    
    const container = findScrollContainer();
    if (!container) return;
    
    scrollContainerRef.current = container;
    
    const handleScroll = () => {
      const threshold = 60; // Small threshold for compact mode
      setIsScrolled(container.scrollTop > threshold);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    // Check initial state
    handleScroll();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [isMobile]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<{ quarter: number; year: number }>(() => {
    const now = new Date();
    return { quarter: Math.floor(now.getMonth() / 3) + 1, year: now.getFullYear() };
  });
  const [yearPopoverOpen, setYearPopoverOpen] = useState(false);
  const [quarterPopoverOpen, setQuarterPopoverOpen] = useState(false);
  const [, navigate] = useLocation();
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("invoice.pdf");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<number | null>(null);
  const [moveToRubbishDialogOpen, setMoveToRubbishDialogOpen] = useState(false);
  const [moveToRubbishTargetId, setMoveToRubbishTargetId] = useState<number | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [revertTarget, setRevertTarget] = useState<{ id: number; targetStatus: "draft" | "open"; currentStatus: "open" | "paid" } | null>(null);
  // Batch revert state - stores validated invoices and skipped items
  const [batchRevertDialogOpen, setBatchRevertDialogOpen] = useState(false);
  const [batchRevertData, setBatchRevertData] = useState<{
    targetStatus: "draft" | "open";
    currentStatus: "open" | "paid";
    validInvoiceIds: number[];
    skippedCount: number;
  } | null>(null);
  const [markAsSentDialogOpen, setMarkAsSentDialogOpen] = useState(false);
  const [markAsSentTarget, setMarkAsSentTarget] = useState<{ id: number; invoiceNumber?: string | null; alreadySent: boolean } | null>(null);
  const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
  const [markAsPaidTarget, setMarkAsPaidTarget] = useState<{ id: number; invoiceNumber?: string | null; alsoMarkAsSent?: boolean } | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState<{ id: number; invoiceNumber: string } | null>(null);
  const [needsReviewDeleteTarget, setNeedsReviewDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: archivedInvoices = [] } = trpc.invoices.listArchived.useQuery();
  const { data: trashedInvoices = [] } = trpc.invoices.listTrashed.useQuery();
  const { data: needsReviewInvoices = [], refetch: refetchNeedsReview } = trpc.invoices.listNeedsReview.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  
  // Combine all invoices for filtering
  const allInvoices = useMemo(() => {
    const active = invoices.map(inv => ({ ...inv, _status: 'active' as const }));
    const archived = archivedInvoices.map(inv => ({ ...inv, _status: 'archived' as const }));
    const trashed = trashedInvoices.map(inv => ({ ...inv, _status: 'deleted' as const }));
    return [...active, ...archived, ...trashed];
  }, [invoices, archivedInvoices, trashedInvoices]);
  const { data: companySettings } = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  
  // Calculate invoice stats for this year (for subtitle)
  const invoiceStats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearInvoices = invoices.filter((invoice) => {
      if (invoice.cancelledAt) return false;
      const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : null;
      return invoiceDate && invoiceDate.getFullYear() === currentYear;
    });
    
    const total = yearInvoices.length;
    const paid = yearInvoices.filter(inv => {
      if (inv.paidAt) return true;
      const total = parseFloat(inv.total?.toString() || '0');
      const amountPaid = parseFloat(inv.amountPaid?.toString() || '0');
      return amountPaid >= total && total > 0;
    }).length;
    const due = total - paid;
    
    return { total, paid, due };
  }, [invoices]);
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsSentMutation = trpc.invoices.markAsSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as sent");
      refetch();
      refetchNeedsReview();
      setMarkAsSentDialogOpen(false);
      setMarkAsSentTarget(null);
    },
    onError: (err) => {
      // If error is about already sent, show warning dialog
      if (err.message.includes("already been sent") && err.message.includes("confirm")) {
        // This will be handled by checking invoice.sentAt before calling mutation
        return;
      }
      toast.error(err.message);
    },
  });
  const markAsPaidMutation = trpc.invoices.markAsPaid.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as paid");
      refetch();
      refetchNeedsReview();
      setMarkAsPaidDialogOpen(false);
      setMarkAsPaidTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsCancelledMutation = trpc.invoices.markAsCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as cancelled");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const markAsNotCancelledMutation = trpc.invoices.markAsNotCancelled.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not cancelled");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const createCancellationMutation = trpc.invoices.createCancellation.useMutation({
    onSuccess: (data) => {
      toast.success("Cancellation invoice created.");
      refetch();
      refetchNeedsReview();
      setCancellationDialogOpen(false);
      setCancellationTarget(null);
      navigate(`/invoices/${data.cancellationInvoiceId}`);
    },
    onError: (err) => toast.error(err.message),
  });
  const archiveMutation = trpc.invoices.archive.useMutation({
    onSuccess: () => {
      toast.success("Invoice archived");
      refetch();
      refetchNeedsReview();
      utils.invoices.listArchived.invalidate();
      utils.invoices.listTrashed.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
      refetchNeedsReview();
      utils.invoices.listTrashed.invalidate();
      utils.invoices.listArchived.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const duplicateInvoiceMutation = trpc.invoices.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Invoice duplicated");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const revertMutation = trpc.invoices.revertStatus.useMutation({
    onSuccess: () => {
      toast.success("Invoice status reverted");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const revertToDraftMutation = trpc.invoices.revertToDraft.useMutation({
    onSuccess: () => {
      toast.success("Invoice reverted to draft");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const revertToSentMutation = trpc.invoices.revertToSent.useMutation({
    onSuccess: () => {
      toast.success("Invoice marked as not paid");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  // Use AI OCR (documents.process) instead of simple PDF parser
  const processDocumentMutation = trpc.documents.process.useMutation({
    onSuccess: (data) => {
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (err) => {
      toast.error("Failed to process invoice: " + err.message);
    },
  });
  const bulkUploadMutation = trpc.invoices.uploadInvoicesBulk.useMutation({
    onSuccess: (data) => {
      const successCount = data.success;
      const errorCount = data.errors?.length || 0;
      if (errorCount === 0) {
        toast.success(`Successfully uploaded ${successCount} invoice${successCount !== 1 ? "s" : ""}`);
      } else {
        toast.warning(
          `Uploaded ${successCount} invoice${successCount !== 1 ? "s" : ""}, ${errorCount} failed`
        );
        if (data.errors) {
          data.errors.forEach((err) => {
            toast.error(`${err.filename}: ${err.error}`);
          });
        }
      }
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => {
      toast.error("Failed to upload invoices: " + err.message);
    },
  });
  const needsReviewDeleteMutation = trpc.invoices.cancelUploadedInvoice.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      setNeedsReviewDeleteTarget(null);
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-focus search input on mobile when search opens
  useEffect(() => {
    if (isSearchOpen && isMobile) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        if (searchInputRef.current) {
          searchInputRef.current.click();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen, isMobile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const applySearch = () => {
    setSearchQuery(searchDraft.trim());
    setIsSearchOpen(false);
  };

  const clearSearch = () => {
    setSearchDraft("");
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  const revertFilters = () => {
    setFilters(defaultFilters);
  };

  // Get client name for an invoice
  const getInvoiceClient = (invoice: any) => {
    if (invoice.clientId || invoice.contactId) {
      const contact = contacts.find(
        (c) => c.id === invoice.clientId || c.id === invoice.contactId
      );
      return contact?.name || contact?.clientName || null;
    }
    return null;
  };

  // Filter invoices helper
  const filterInvoices = (invoices: any[]) => {
    return invoices.filter((invoice) => {
      // Search matching - client name, date (month), amount
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (() => {
        // Client name match
        const clientName = getInvoiceClient(invoice) || "";
        if (clientName.toLowerCase().includes(searchLower)) return true;

        // Date month match (e.g., "October")
        if (invoice.issueDate) {
          const issueDate = new Date(invoice.issueDate);
          const monthName = issueDate.toLocaleDateString("en-US", { month: "long" }).toLowerCase();
          if (monthName.includes(searchLower)) return true;
        }

        // Amount match (exact or partial numeric value)
        const totalStr = invoice.total?.toString() || "";
        const totalNum = parseFloat(totalStr);
        if (!isNaN(totalNum)) {
          const searchNum = parseFloat(searchLower);
          if (!isNaN(searchNum)) {
            // Check if search number appears in total (e.g., "500" matches "1500", "500.50", etc.)
            if (totalStr.includes(searchLower) || totalNum === searchNum) return true;
          }
        }

        // Invoice number match
        if (invoice.invoiceNumber?.toLowerCase().includes(searchLower)) return true;
        if (invoice.invoiceName?.toLowerCase().includes(searchLower)) return true;

        return false;
      })();

      // Project filter (for now, invoices don't have direct projectId, so we'll use "all" or "unassigned")
      const matchesProject = filters.project === "all" || 
        (filters.project === "unassigned" ? !invoice.jobId : false);

      // Client filter
      const matchesClient =
        filters.client === "all" ||
        (filters.client === "unassigned"
          ? !invoice.clientId && !invoice.contactId
          : invoice.clientId?.toString() === filters.client || invoice.contactId?.toString() === filters.client);

      // Time filter (based on issueDate) - supports "all", "2024" (year), or "2024-10" (year-month)
      const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
      const matchesTime =
        filters.time === "all" ||
        (issueDate && (() => {
          const invoiceYear = issueDate.getFullYear();
          const invoiceMonth = issueDate.getMonth() + 1; // 1-12
          
          // If filter is just a year (e.g., "2024")
          if (/^\d{4}$/.test(filters.time)) {
            return invoiceYear === parseInt(filters.time, 10);
          }
          
          // If filter is year-month format (e.g., "2024-10")
          if (/^\d{4}-\d{1,2}$/.test(filters.time)) {
            const [filterYear, filterMonth] = filters.time.split("-").map(Number);
            return invoiceYear === filterYear && invoiceMonth === filterMonth;
          }
          
          return false;
        })());

      // Status filter
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && invoice._status === "active") ||
        (filters.status === "archived" && invoice._status === "archived") ||
        (filters.status === "deleted" && invoice._status === "deleted");

      return matchesSearch && matchesProject && matchesClient && matchesTime && matchesStatus;
    });
  };

  const filteredInvoices = useMemo(() => {
    const filtered = filterInvoices(allInvoices);
    // Ensure selected items remain visible even if they don't match filters
    const selectedInvoiceIds = Array.from(selectedIds);
    const selectedInvoices = selectedInvoiceIds
      .map(id => allInvoices.find(inv => inv.id === id))
      .filter(Boolean) as typeof allInvoices;
    
    // Combine filtered invoices with selected invoices (remove duplicates)
    const filteredIds = new Set(filtered.map(inv => inv.id));
    const additionalSelected = selectedInvoices.filter(inv => !filteredIds.has(inv.id));
    
    return [...filtered, ...additionalSelected];
  }, [allInvoices, selectedIds, searchQuery, filters]);

  // Calculate invoice totals for all years and quarters
  const { yearPaid, yearDue, quarterPaid, quarterDue, allYearTotals, allQuarterTotals } = useMemo(() => {
    // Use selected year/quarter for display
    const displayYear = selectedYear;
    const displayQuarter = selectedQuarter.quarter;
    const displayQuarterYear = selectedQuarter.year;
    
    const quarterStart = new Date(displayQuarterYear, (displayQuarter - 1) * 3, 1);
    const quarterEnd = new Date(displayQuarterYear, displayQuarter * 3, 0, 23, 59, 59);

    let yearPaidSum = 0;
    let yearDueSum = 0;
    let quarterPaidSum = 0;
    let quarterDueSum = 0;
    const yearPaidMap = new Map<number, number>();
    const yearDueMap = new Map<number, number>();
    const quarterPaidMap = new Map<string, number>();
    const quarterDueMap = new Map<string, number>();

    allInvoices.forEach((invoice) => {
      // Only count active invoices (not archived or deleted)
      if (invoice._status !== 'active') return;
      
      // Exclude cancelled invoices from revenue
      if (invoice.cancelledAt) return;
      
      // Only count sent/paid invoices (not drafts)
      if (!invoice.sentAt && !invoice.paidAt) return;

      const total = parseFloat(invoice.total?.toString() || '0');
      if (isNaN(total)) return;

      const amountPaid = parseFloat(invoice.amountPaid?.toString() || '0');
      const isPaid = invoice.paidAt !== null || amountPaid >= total;
      const paidAmount = isPaid ? total : amountPaid;
      const dueAmount = total - paidAmount;

      // CRITICAL: Use accounting date instead of issue date
      // Accounting date is determined by company settings (paidAt for EÜR, servicePeriodEnd for Bilanz)
      const accountingResult = getAccountingDate(invoice, companySettings);
      
      // Skip invoices without accounting date (not yet recognized as income)
      if (!accountingResult.accountingDate || !accountingResult.accountingYear || !accountingResult.accountingQuarter) {
        return;
      }

      const accountingYear = accountingResult.accountingYear;
      const accountingQuarter = accountingResult.accountingQuarter;
      const quarterKey = `Q${accountingQuarter} ${accountingYear}`;

      // Add to year totals
      const existingYearPaid = yearPaidMap.get(accountingYear) || 0;
      yearPaidMap.set(accountingYear, existingYearPaid + paidAmount);
      const existingYearDue = yearDueMap.get(accountingYear) || 0;
      yearDueMap.set(accountingYear, existingYearDue + dueAmount);

      // Add to quarter totals
      const existingQuarterPaid = quarterPaidMap.get(quarterKey) || 0;
      quarterPaidMap.set(quarterKey, existingQuarterPaid + paidAmount);
      const existingQuarterDue = quarterDueMap.get(quarterKey) || 0;
      quarterDueMap.set(quarterKey, existingQuarterDue + dueAmount);

      // Selected year and quarter
      if (accountingYear === displayYear) {
        yearPaidSum += paidAmount;
        yearDueSum += dueAmount;
      }
      if (accountingYear === displayQuarterYear && accountingResult.accountingDate >= quarterStart && accountingResult.accountingDate <= quarterEnd) {
        quarterPaidSum += paidAmount;
        quarterDueSum += dueAmount;
      }
    });

    // Get all years with data (only include years that have invoice data)
    const yearsWithData = Array.from(new Set([...yearPaidMap.keys(), ...yearDueMap.keys()]));
    
    // Always include the current year, even if it has no data yet
    const currentYear = new Date().getFullYear();
    const allYearsSet = new Set(yearsWithData);
    allYearsSet.add(currentYear);
    
    // Convert to sorted array - includes years with data plus current year
    const allYears = Array.from(allYearsSet).sort((a, b) => b - a);
    const allYearTotals = allYears.map(year => ({
      year,
      paid: yearPaidMap.get(year) || 0,
      due: yearDueMap.get(year) || 0,
      total: (yearPaidMap.get(year) || 0) + (yearDueMap.get(year) || 0)
    }));

    // Get all quarters with data (only include quarters that have invoice data)
    const quartersWithData = Array.from(new Set([...quarterPaidMap.keys(), ...quarterDueMap.keys()]));
    
    // Always include the current quarter, even if it has no data yet
    const currentDate = new Date();
    const currentQuarterYear = currentDate.getFullYear();
    const currentQuarterNum = Math.floor(currentDate.getMonth() / 3) + 1;
    const currentQuarterKey = `Q${currentQuarterNum} ${currentQuarterYear}`;
    const quartersWithDataSet = new Set(quartersWithData);
    quartersWithDataSet.add(currentQuarterKey);
    
    // Convert quarter map to sorted array (by year desc, then quarter desc)
    // Includes quarters with data plus current quarter
    const allQuarters = Array.from(quartersWithDataSet)
      .map((key) => {
        const match = key.match(/Q(\d+) (\d+)/);
        if (!match) return null;
        const quarter = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);
        const paid = quarterPaidMap.get(key) || 0;
        const due = quarterDueMap.get(key) || 0;
        return {
          key,
          quarter,
          year,
          paid,
          due,
          total: paid + due
        };
      })
      .filter((q): q is { key: string; quarter: number; year: number; paid: number; due: number; total: number } => q !== null)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.quarter - a.quarter;
      });

    return {
      yearPaid: yearPaidSum,
      yearDue: yearDueSum,
      quarterPaid: quarterPaidSum,
      quarterDue: quarterDueSum,
      allYearTotals,
      allQuarterTotals: allQuarters,
    };
  }, [allInvoices, selectedYear, selectedQuarter, companySettings]);

  const handlePreviewPDF = async (invoiceId: number, fileName: string) => {
    try {
      // Get the session token from Supabase
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());

      if (!session?.access_token) {
        toast.error("Please log in to preview invoices");
        return;
      }

      // Fetch the PDF with credentials
      const response = await fetch(`/api/invoices/${invoiceId}/pdf?preview=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to generate preview');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
      setPreviewFileName(fileName);
      setPreviewModalOpen(true);
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to open preview');
    }
  };

  const handleIssueInvoice = async (invoiceId: number) => {
    if (!confirm("Send this invoice? This locks the invoice number.")) return;
    await issueMutation.mutateAsync({ id: invoiceId });
  };

  const handleArchiveInvoice = (invoiceId: number) => {
    setArchiveTargetId(invoiceId);
    setArchiveDialogOpen(true);
  };

  const handleMoveToRubbish = (invoiceId: number) => {
    setMoveToRubbishTargetId(invoiceId);
    setMoveToRubbishDialogOpen(true);
  };

  const handleRevertStatus = (invoiceId: number, currentStatus: "open" | "paid") => {
    const targetStatus = currentStatus === "open" ? "draft" : "open";
    setRevertTarget({ id: invoiceId, targetStatus, currentStatus });
    setRevertDialogOpen(true);
  };

  const handleCreateCancellation = (invoice: { id: number; invoiceNumber: string }) => {
    setCancellationTarget({ id: invoice.id, invoiceNumber: invoice.invoiceNumber });
    setCancellationDialogOpen(true);
  };

  const toggleSelection = (invoiceId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    // Include both regular invoices and needs review invoices
    const allInvoiceIds = [
      ...filteredInvoices.map(i => i.id),
      ...needsReviewInvoices.map(i => i.id)
    ];
    setSelectedIds(new Set(allInvoiceIds));
  };

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      archiveMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDuplicate = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      duplicateInvoiceMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      // Check if this is a needs review invoice
      const needsReviewInvoice = needsReviewInvoices.find(inv => inv.id === id);
      if (needsReviewInvoice) {
        // Use cancelUploadedInvoice for needs review invoices
        needsReviewDeleteMutation.mutate({ id });
      } else {
        // Use moveToTrash for regular invoices
        moveToTrashMutation.mutate({ id });
      }
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchMarkAsSent = () => {
    if (selectedIds.size === 0) return;
    
    // Check if any selected invoices are already sent
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    const alreadySentInvoices = selectedInvoices.filter(inv => inv.sentAt);
    
    if (alreadySentInvoices.length > 0) {
      // Show warning dialog for batch operation
      // For batch, we'll process all with confirmation
      const ids = Array.from(selectedIds);
      ids.forEach((id) => {
        markAsSentMutation.mutate({ id, confirmed: true });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    } else {
      // No already-sent invoices, proceed normally
      const ids = Array.from(selectedIds);
      ids.forEach((id) => {
        markAsSentMutation.mutate({ id });
      });
      setSelectedIds(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const handleBatchMarkAsPaid = () => {
    if (selectedIds.size === 0) return;
    
    // Get all selected invoices
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    // Validate each invoice and collect results
    const validInvoices: typeof selectedInvoices = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    
    selectedInvoices.forEach((invoice) => {
      const validation = isActionValidForInvoice("markAsPaid", invoice);
      if (validation.valid) {
        validInvoices.push(invoice);
      } else {
        skipped.push({ id: invoice.id, reason: validation.reason || "Invalid" });
      }
    });
    
    // For batch operations, use today's date as default
    // User can mark individually if they need different dates
    const paidAt = new Date();
    paidAt.setHours(0, 0, 0, 0);

    // Process valid invoices
    validInvoices.forEach((invoice) => {
      // For uploaded invoices that haven't been sent, mark as sent and paid
      if (!invoice.sentAt && invoice.source === "uploaded") {
        markAsPaidMutation.mutate({ id: invoice.id, paidAt, alsoMarkAsSent: true });
      } else {
        markAsPaidMutation.mutate({ id: invoice.id, paidAt });
      }
    });
    
    // Show summary toast
    if (skipped.length > 0) {
      toast.warning(
        `Skipped ${skipped.length} invoice(s): ${skipped.map(s => s.reason).join(", ")}`
      );
    }
    if (validInvoices.length > 0) {
      toast.success(`Marked ${validInvoices.length} invoice(s) as paid`);
    }
    
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchMarkAsCancelled = () => {
    if (selectedIds.size === 0) return;
    
    // Get all selected invoices
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    // Validate each invoice and collect results
    const validInvoices: typeof selectedInvoices = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    
    selectedInvoices.forEach((invoice) => {
      const validation = isActionValidForInvoice("markAsCancelled", invoice);
      if (validation.valid) {
        validInvoices.push(invoice);
      } else {
        skipped.push({ id: invoice.id, reason: validation.reason || "Invalid" });
      }
    });
    
    // Process valid invoices
    validInvoices.forEach((invoice) => {
      markAsCancelledMutation.mutate({ id: invoice.id });
    });
    
    // Show summary toast
    if (skipped.length > 0) {
      toast.warning(
        `Skipped ${skipped.length} invoice(s): ${skipped.map(s => s.reason).join(", ")}`
      );
    }
    if (validInvoices.length > 0) {
      toast.success(`Marked ${validInvoices.length} invoice(s) as cancelled`);
    }
    
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchMarkAsNotCancelled = () => {
    if (selectedIds.size === 0) return;
    
    // Get all selected invoices
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    // Validate each invoice and collect results
    const validInvoices: typeof selectedInvoices = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    
    selectedInvoices.forEach((invoice) => {
      const validation = isActionValidForInvoice("markAsNotCancelled", invoice);
      if (validation.valid) {
        validInvoices.push(invoice);
      } else {
        skipped.push({ id: invoice.id, reason: validation.reason || "Invalid" });
      }
    });
    
    // Process valid invoices
    validInvoices.forEach((invoice) => {
      markAsNotCancelledMutation.mutate({ id: invoice.id });
    });
    
    // Show summary toast
    if (skipped.length > 0) {
      toast.warning(
        `Skipped ${skipped.length} invoice(s): ${skipped.map(s => s.reason).join(", ")}`
      );
    }
    if (validInvoices.length > 0) {
      toast.success(`Marked ${validInvoices.length} invoice(s) as not cancelled`);
    }
    
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchRevertToDraft = () => {
    if (selectedIds.size === 0) return;
    
    // Get all selected invoices
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    // Validate each invoice and collect results
    const validInvoices: typeof selectedInvoices = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    
    selectedInvoices.forEach((invoice) => {
      const validation = isActionValidForInvoice("revertToDraft", invoice);
      if (validation.valid) {
        validInvoices.push(invoice);
      } else {
        skipped.push({ id: invoice.id, reason: validation.reason || "Invalid" });
      }
    });
    
    // CRITICAL: Batch revert actions MUST show confirmation dialog - no bypass allowed
    // Store validated data and show dialog
    if (validInvoices.length > 0) {
      setBatchRevertData({
        targetStatus: "draft",
        currentStatus: "open",
        validInvoiceIds: validInvoices.map(inv => inv.id),
        skippedCount: skipped.length,
      });
      setBatchRevertDialogOpen(true);
    } else {
      // No valid invoices - show error
      toast.error("No invoices can be reverted to draft. All selected invoices are not eligible for this action.");
      if (skipped.length > 0) {
        toast.warning(
          `Reasons: ${skipped.map(s => s.reason).join(", ")}`
        );
      }
    }
  };
  
  // Handler for confirmed batch revert to draft
  // CRITICAL: This handler is ONLY called from RevertInvoiceStatusDialog.onConfirm
  // after the user has acknowledged the warning by checking the checkbox.
  // Never call this directly - always go through the dialog.
  const handleConfirmBatchRevertToDraft = () => {
    if (!batchRevertData || batchRevertData.targetStatus !== "draft") return;
    
    // Process all valid invoices
    batchRevertData.validInvoiceIds.forEach((id) => {
      revertToDraftMutation.mutate({ id, confirmed: true });
    });
    
    // Show summary toast
    if (batchRevertData.skippedCount > 0) {
      toast.warning(
        `${batchRevertData.skippedCount} invoice(s) were skipped because they are not eligible for this action.`
      );
    }
    if (batchRevertData.validInvoiceIds.length > 0) {
      toast.success(`Reverted ${batchRevertData.validInvoiceIds.length} invoice(s) to draft`);
    }
    
    // Close dialog and reset
    setBatchRevertDialogOpen(false);
    setBatchRevertData(null);
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchRevertToSent = () => {
    if (selectedIds.size === 0) return;
    
    // Get all selected invoices
    const selectedInvoices = Array.from(selectedIds)
      .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
      .filter(Boolean) as typeof filteredInvoices;
    
    // Validate each invoice and collect results
    const validInvoices: typeof selectedInvoices = [];
    const skipped: Array<{ id: number; reason: string }> = [];
    
    selectedInvoices.forEach((invoice) => {
      const validation = isActionValidForInvoice("revertToSent", invoice);
      if (validation.valid) {
        validInvoices.push(invoice);
      } else {
        skipped.push({ id: invoice.id, reason: validation.reason || "Invalid" });
      }
    });
    
    // CRITICAL: Batch revert actions MUST show confirmation dialog - no bypass allowed
    // Store validated data and show dialog
    if (validInvoices.length > 0) {
      setBatchRevertData({
        targetStatus: "open",
        currentStatus: "paid",
        validInvoiceIds: validInvoices.map(inv => inv.id),
        skippedCount: skipped.length,
      });
      setBatchRevertDialogOpen(true);
    } else {
      // No valid invoices - show error
      toast.error("No invoices can be marked as not paid. All selected invoices are not eligible for this action.");
      if (skipped.length > 0) {
        toast.warning(
          `Reasons: ${skipped.map(s => s.reason).join(", ")}`
        );
      }
    }
  };
  
  // Handler for confirmed batch mark as not paid
  // CRITICAL: This handler is ONLY called from RevertInvoiceStatusDialog.onConfirm
  // after the user has acknowledged the warning by checking the checkbox.
  // Never call this directly - always go through the dialog.
  const handleConfirmBatchRevertToSent = () => {
    if (!batchRevertData || batchRevertData.targetStatus !== "open") return;
    
    // Process all valid invoices
    batchRevertData.validInvoiceIds.forEach((id) => {
      revertToSentMutation.mutate({ id, confirmed: true });
    });
    
    // Show summary toast
    if (batchRevertData.skippedCount > 0) {
      toast.warning(
        `${batchRevertData.skippedCount} invoice(s) were skipped because they are not eligible for this action.`
      );
    }
    if (batchRevertData.validInvoiceIds.length > 0) {
      toast.success(`Marked ${batchRevertData.validInvoiceIds.length} invoice(s) as not paid`);
    }
    
    // Close dialog and reset
    setBatchRevertDialogOpen(false);
    setBatchRevertData(null);
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBulkUpload = async (files: File[]) => {
    try {
      // Preserve file order: files are already in selection order
      // First selected will be uploaded first, so they appear at the bottom
      // Last selected will be uploaded last, so they appear at the top (newest first)
      const fileData = await Promise.all(
        files.map(async (file) => {
          const reader = new FileReader();
          return new Promise<{
            filename: string;
            mimeType: string;
            fileSize: number;
            base64Data: string;
          }>((resolve, reject) => {
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(",")[1];
              resolve({
                filename: file.name,
                mimeType: file.type,
                fileSize: file.size,
                base64Data,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // Files are processed in order, so first selected appears first in DB
      // Since invoices page shows newest first, last selected will appear at top
      bulkUploadMutation.mutate({ files: fileData });
    } catch (error) {
      toast.error("Failed to process files");
    }
  };

  // Note: Don't early return here - render BulkInvoiceUploadDialog at the bottom
  // to ensure consistent hook order

  const getStatusBadge = (invoice: any) => {
    const invoiceState = getInvoiceState(invoice);
    const derivedValues = getDerivedValues(invoice);
    
    // Cancelled badge (dark color) - highest priority
    if (invoice.cancelledAt) {
      return (
        <Badge 
          variant="outline" 
          className="text-[11px] uppercase tracking-widest font-normal border-foreground text-foreground dark:border-white dark:text-white"
        >
          CANCELLED
        </Badge>
      );
    }
    
    // Badge priority: OVERDUE > PARTIAL > SENT/PAID
    if (derivedValues.isOverdue) {
      return <Badge variant="destructive-outline" className="text-[11px] uppercase tracking-widest font-normal">OVERDUE</Badge>;
    }
    
    if (invoiceState === 'PARTIAL') {
      return <Badge variant="outline" className="text-[11px] uppercase tracking-widest font-normal border-orange-500/50 text-orange-600/80 dark:border-orange-500 dark:text-orange-400 dark:border-orange-600">PARTIAL</Badge>;
    }
    
    if (invoiceState === 'PAID') {
      return (
        <span 
          className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] uppercase tracking-widest font-normal w-fit whitespace-nowrap shrink-0"
          style={{
            backgroundColor: isDarkMode ? '#00FF88' : 'rgb(236, 72, 153)', // green in dark, pink in light
            color: isDarkMode ? '#000000' : 'white',
            borderColor: isDarkMode ? 'rgba(0, 255, 136, 0.5)' : 'rgba(236, 72, 153, 0.5)',
          }}
        >
          PAID
        </span>
      );
    }
    
    if (invoiceState === 'SENT') {
      return <Badge variant="blue-outline" className="text-[11px] uppercase tracking-widest font-normal">SENT</Badge>;
    }
    
    if (invoiceState === 'DRAFT') {
      return <Badge variant="outline" className="text-[11px] uppercase tracking-widest font-normal border-yellow-500/50 text-yellow-600/80 dark:border-yellow-500 dark:text-yellow-400 dark:border-yellow-600">DRAFT</Badge>;
    }
    
    return null;
  };

  const getInvoiceIcon = () => {
    const country = companySettings?.country?.toLowerCase() || "";
    if (country === "united kingdom" || country === "uk" || country === "great britain") {
      return DocumentCurrencyPound;
    }
    // Default to Euro (Germany or any other country)
    return DocumentCurrencyEuro;
  };

  const hasActiveFilters =
    searchQuery ||
    filters.project !== "all" ||
    filters.client !== "all" ||
    filters.time !== "all" ||
    filters.status !== "active";

  // Search overlay - rendered separately, triggered by onSearch handler
  const searchOverlay = isSearchOpen && (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex flex-col h-full">
        {/* Search input at top */}
        <div className="flex items-center gap-2 p-4 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search client, date (e.g., October), amount..."
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch();
                }
                if (e.key === "Escape") {
                  setIsSearchOpen(false);
                }
              }}
              className="pl-10 pr-10"
              autoFocus
            />
            {searchDraft && (
              <button
                onClick={() => setSearchDraft("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search suggestions/results preview */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchDraft && (
            <div className="space-y-2">
              {(() => {
                const searchLower = searchDraft.toLowerCase();
                return filteredInvoices
                  .filter((invoice) => {
                    const clientName = getInvoiceClient(invoice) || "";
                    if (clientName.toLowerCase().includes(searchLower)) return true;
                    if (invoice.issueDate) {
                      const issueDate = new Date(invoice.issueDate);
                      const monthName = issueDate.toLocaleDateString("en-US", { month: "long" }).toLowerCase();
                      if (monthName.includes(searchLower)) return true;
                    }
                    const totalStr = invoice.total?.toString() || "";
                    const searchNum = parseFloat(searchLower);
                    if (!isNaN(searchNum) && totalStr.includes(searchLower)) return true;
                    if (invoice.invoiceNumber?.toLowerCase().includes(searchLower)) return true;
                    if (invoice.invoiceName?.toLowerCase().includes(searchLower)) return true;
                    return false;
                  })
                  .slice(0, 10)
                  .map((invoice) => {
                    const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
                    const clientName = getInvoiceClient(invoice);
                    const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
                    return (
                      <Card
                        key={invoice.id}
                        className="p-3 cursor-pointer hover:bg-accent"
                        onClick={() => {
                          navigate(`/invoices/${invoice.id}`);
                          setIsSearchOpen(false);
                        }}
                      >
                        <div className="text-base">{displayName}</div>
                        {clientName && (
                          <div className="text-sm text-muted-foreground">{clientName}</div>
                        )}
                        {issueDate && (
                          <div className="text-sm text-muted-foreground">
                            {issueDate.toLocaleDateString("de-DE")}
                          </div>
                        )}
                      </Card>
                    );
                  });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Filter sheet - rendered separately, controlled by PageHeader's onFilter handler
  const filterSheet = (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetContent side="right" className="p-0">
        <SheetHeader className="px-4 pt-4">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-y-auto space-y-4 pt-4">
          {/* Project Filter */}
          <div className="space-y-2">
            <div className="text-sm">Project</div>
            <Select
              value={filters.project}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, project: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {projects.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No projects available
                  </div>
                ) : (
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Client Filter */}
          <div className="space-y-2">
            <div className="text-sm">Client</div>
            <Select
              value={filters.client}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, client: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {contacts.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No contacts available
                  </div>
                ) : (
                  contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.name || contact.clientName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Time Filter (Issue Date) */}
          <div className="space-y-2">
            <div className="text-sm">Time</div>
            <Select
              value={filters.time}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  time: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                {/* Generate years (current year and 5 years back) */}
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const years = [];
                  for (let year = currentYear; year >= currentYear - 5; year--) {
                    years.push(
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                    // Add months for each year (January to December)
                    for (let month = 1; month <= 12; month++) {
                      const monthValue = `${year}-${month}`;
                      const monthName = monthDisplayNames[month - 1];
                      years.push(
                        <SelectItem key={monthValue} value={monthValue}>
                          {monthName} {year}
                        </SelectItem>
                      );
                    }
                  }
                  return years;
                })()}
              </SelectContent>
            </Select>
          </div>

          {/* Status Buttons */}
          <div className="space-y-2">
            <div className="text-sm">Status</div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  window.location.pathname === "/invoices" && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => {
                  navigate("/invoices");
                  setIsFilterOpen(false);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Active
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  window.location.pathname === "/invoices/archived" && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => {
                  navigate("/invoices/archived");
                  setIsFilterOpen(false);
                }}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  "hover:bg-destructive hover:text-destructive-foreground",
                  window.location.pathname === "/invoices/rubbish" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => {
                  navigate("/invoices/rubbish");
                  setIsFilterOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deleted
              </Button>
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={revertFilters}>
            Revert
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  // Calculate padding for multi-select bar
  // Bar height: min-h-[44px] + padding (14px * 2) + marginBottom (1rem = 16px) + safe area
  // Roughly: 44 + 28 + 16 = 88px minimum, but add extra for safety and wrapping
  const multiSelectPadding = useMemo(() => {
    if (!isMultiSelectMode) return undefined;
    // On mobile, account for bottom tab bar + safe area
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      // Multi-select bar is above tab bar, so we need: bar height + some spacing
      return '140px'; // Enough to clear both bar and tab bar
    }
    return '120px'; // Desktop: just the bar height
  }, [isMultiSelectMode]);

  return (
    <div 
      className="space-y-6"
      style={{
        paddingBottom: multiSelectPadding,
      }}
    >
      {/* Search overlay - controlled by PageHeader's onSearch handler */}
      {searchOverlay}
      
      {/* Filter sheet - controlled by PageHeader's onFilter handler */}
      {filterSheet}
      
      {/* Desktop: Glass control surface header */}
      {!isMobile ? (() => {
        // Calculate contextual subtitle
        const activeInvoices = filteredInvoices.filter(inv => inv._status === 'active');
        const invoiceCount = activeInvoices.length;
        
        // Calculate outstanding amount (sent but not paid)
        const outstandingAmount = activeInvoices.reduce((sum, inv) => {
          if (inv.sentAt && !inv.paidAt && !inv.cancelledAt) {
            const total = parseFloat(inv.total?.toString() || '0');
            const paid = parseFloat(inv.amountPaid?.toString() || '0');
            return sum + (total - paid);
          }
          return sum;
        }, 0);
        
        // Get current quarter label
        const currentQuarter = `Q${selectedQuarter.quarter} ${selectedQuarter.year}`;
        
        const subtitleParts = [
          `${invoiceCount} ${invoiceCount === 1 ? 'invoice' : 'invoices'}`,
          outstandingAmount > 0 ? `${formatCurrency(outstandingAmount)} outstanding` : null,
          currentQuarter
        ].filter(Boolean);
        
        const contextualSubtitle = subtitleParts.join(' · ');
        
        return (
          <div 
            className={cn(
              "bg-card border border-border/70 rounded-2xl shadow-sm",
              "transition-all duration-[var(--dur-standard)] ease-[var(--ease-out)]",
              "kpi-card-accent invoices-header-accent",
              isScrolled && "invoices-header-compact"
            )}
            style={{
              padding: isScrolled ? '12px var(--space-card-padding, 16px)' : 'var(--space-card-padding, 16px)',
              marginBottom: '24px',
            }}
          >
            <div className="flex items-center justify-between gap-4">
              {/* Left block: Title + Subtitle */}
              <div className="flex-1 min-w-0">
                <h1 className={cn(
                  "font-normal mb-1 transition-all duration-[var(--dur-standard)] ease-[var(--ease-out)]",
                  isScrolled ? "text-2xl" : "text-3xl"
                )}>
                  Invoices
                </h1>
                <p className={cn(
                  "text-sm text-muted-foreground/70 leading-tight transition-all duration-[var(--dur-standard)] ease-[var(--ease-out)]",
                  isScrolled && "opacity-0 -translate-y-1 pointer-events-none"
                )}>
                  {contextualSubtitle}
                </p>
              </div>
              
              {/* Right block: Icon buttons + Primary actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Icon buttons cluster */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label="Search"
                    onClick={() => setIsSearchOpen(true)}
                    className="size-9 [&_svg]:!size-8 sm:[&_svg]:!size-5 hover:bg-muted/50"
                  >
                    <Search />
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label="Filter"
                    onClick={() => setIsFilterOpen(true)}
                    className="size-9 [&_svg]:!size-8 sm:[&_svg]:!size-5 hover:bg-muted/50"
                  >
                    <SlidersHorizontal />
                  </Button>
                  <Button
                    variant="icon"
                    size="icon"
                    aria-label="Settings"
                    onClick={() => navigate("/settings")}
                    className="size-9 [&_svg]:!size-8 sm:[&_svg]:!size-5 hover:bg-muted/50"
                  >
                    <Settings />
                  </Button>
                </div>
                
                {/* Primary actions */}
                <div className="flex items-center gap-2 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBulkUploadOpen(true)}
                    disabled={bulkUploadMutation.isPending}
                    className="h-9 whitespace-nowrap text-sm"
                    data-guide-id="invoices.upload"
                    data-guide-type="button"
                    data-guide-label="Upload Invoice PDFs"
                  >
                    {bulkUploadMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1.5" />
                    )}
                    Upload
                  </Button>
                  <Button 
                    onClick={() => navigate("/invoices/new")}
                    className="h-9 whitespace-nowrap text-sm"
                    data-guide-id="invoices.create"
                    data-guide-type="button"
                    data-guide-label="Create New Invoice"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
        // Mobile: Keep existing PageHeader
        <PageHeader
          title="Invoices"
          subtitle={`${invoiceStats.total} this year · ${invoiceStats.paid} paid · ${invoiceStats.due} due`}
          onSearch={() => setIsSearchOpen(true)}
          onFilter={() => setIsFilterOpen(true)}
          onSettings={() => navigate("/settings")}
          primaryActions={
            <div className="flex flex-row sm:contents gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkUploadOpen(true)}
                disabled={bulkUploadMutation.isPending}
                className="h-10 whitespace-nowrap flex-1 sm:flex-initial"
                data-guide-id="invoices.upload"
                data-guide-type="button"
                data-guide-label="Upload Invoice PDFs"
              >
                {bulkUploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload
              </Button>
              <Button
                onClick={() => navigate("/invoices/new")}
                className="h-10 whitespace-nowrap flex-1 sm:flex-initial"
                data-guide-id="invoices.create"
                data-guide-type="button"
                data-guide-label="Create New Invoice"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </div>
          }
        />
      )}

      {/* Total Cards */}
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <YearTotalCard
            selectedYear={selectedYear}
            yearPaid={yearPaid}
            yearDue={yearDue}
            allYearTotals={allYearTotals}
            onYearSelect={(year) => setSelectedYear(year)}
            popoverOpen={yearPopoverOpen}
            onPopoverOpenChange={setYearPopoverOpen}
          />
          <QuarterTotalCard
            selectedQuarter={selectedQuarter}
            quarterPaid={quarterPaid}
            quarterDue={quarterDue}
            allQuarterTotals={allQuarterTotals}
            onQuarterSelect={(quarter, year) => setSelectedQuarter({ quarter, year })}
            popoverOpen={quarterPopoverOpen}
            onPopoverOpenChange={setQuarterPopoverOpen}
          />
        </div>
      </div>

      {needsReviewInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-light uppercase tracking-wide text-muted-foreground">Needs Review</h2>
            <Badge variant="secondary" className="text-xs">
              {needsReviewInvoices.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {needsReviewInvoices.map((invoice) => {
              const uploadDate = invoice.uploadedAt || invoice.uploadDate || invoice.createdAt;
              const uploadDateLabel = uploadDate ? new Date(uploadDate).toLocaleDateString("de-DE") : "Unknown date";
              const displayName =
                invoice.invoiceName ||
                (invoice.filename ? invoice.filename.replace(/\.[^/.]+$/, "") : null) ||
                "Untitled invoice";
              const displayTotal = formatCurrency(invoice.total);
              const linkedContact = contacts.find(
                (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
              );
              const clientName = linkedContact?.name || linkedContact?.clientName || "No client";
              
              const handleNeedsReviewClick = () => {
                if (isMultiSelectMode) {
                  toggleSelection(invoice.id);
                } else {
                  navigate(`/invoices/${invoice.id}`);
                }
              };
              
              return (
                <Card
                  key={`needs-review-${invoice.id}`}
                  onClick={handleNeedsReviewClick}
                  data-item={invoice.id}
                  className={cn(
                    "card p-3 sm:p-4 md:min-h-[120px] card-hover-polish",
                    !isMultiSelectMode && "cursor-pointer",
                    selectedIds.has(invoice.id) && "item-selected"
                  )}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {(() => {
                          const InvoiceIcon = getInvoiceIcon();
                          return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                        })()}
                        <div className="min-w-0">
                          <div className="text-base leading-tight break-words">{displayName}</div>
                          <div className="text-xs text-muted-foreground">Uploaded {uploadDateLabel}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-base font-normal tabular-nums">{displayTotal}</div>
                        <Badge variant="outline" className="badge-needs-review text-[11px] uppercase tracking-widest font-normal">NEEDS REVIEW</Badge>
                        <Badge variant="secondary" className="text-xs">UPLOADED</Badge>
                        {!isMultiSelectMode && (() => {
                      const availableActions = getInvoiceActions({
                        invoice,
                        selectionMode: false,
                      });
                      return (
                        <ItemActionsMenu
                          actions={availableActions}
                          onAction={(action) => {
                            switch (action) {
                              case "edit":
                                navigate(`/invoices/${invoice.id}`);
                                break;
                              case "duplicate":
                                duplicateInvoiceMutation.mutate({ id: invoice.id });
                                break;
                              case "select":
                                setIsMultiSelectMode(true);
                                setSelectedIds(new Set([invoice.id]));
                                break;
                              case "archive":
                                handleArchiveInvoice(invoice.id);
                                break;
                              case "delete":
                                setNeedsReviewDeleteTarget({ id: invoice.id, name: displayName });
                                break;
                              case "markAsSent":
                                if (invoice.sentAt) {
                                  setMarkAsSentTarget({ 
                                    id: invoice.id, 
                                    invoiceNumber: invoice.invoiceNumber,
                                    alreadySent: true 
                                  });
                                  setMarkAsSentDialogOpen(true);
                                } else {
                                  markAsSentMutation.mutate({ id: invoice.id });
                                }
                                break;
                              case "markAsPaid":
                                setMarkAsPaidTarget({ 
                                  id: invoice.id, 
                                  invoiceNumber: invoice.invoiceNumber,
                                  alsoMarkAsSent: true
                                });
                                setMarkAsPaidDialogOpen(true);
                                break;
                              case "markAsCancelled":
                                markAsCancelledMutation.mutate({ id: invoice.id });
                                break;
                              case "markAsNotCancelled":
                                markAsNotCancelledMutation.mutate({ id: invoice.id });
                                break;
                              default:
                                console.warn("Unknown action:", action);
                            }
                          }}
                        />
                      );
                    })()}
                      </div>
                    </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {filteredInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "No invoices found matching your filters"
              : "No invoices found. Create your first invoice to get started."}
          </p>
          {!hasActiveFilters && (
            <Button
              onClick={() => navigate("/invoices/new")}
              variant="outline"
              className="mt-4"
            >
              Create your first invoice
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {filteredInvoices.map((invoice) => {
            const linkedContact = contacts.find(
              (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
            );
            const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
            const isPaid = Boolean(invoice.paidAt);
            const isOpen = Boolean(invoice.sentAt) && !invoice.paidAt;
            const isDraft = !invoice.sentAt && !invoice.paidAt && invoice.status === "draft";
            const isStandard = invoice.type !== "cancellation";
            const hasInvoiceNumber = Boolean(invoice.invoiceNumber);
            const canCancel = isStandard && hasInvoiceNumber && invoice.source !== "uploaded" && !invoice.hasCancellation && (isOpen || isPaid);
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const displayTotal = formatCurrency(invoice.total);
            // Use shared action model for consistent actions across long-press and multi-select
            const availableActions = getInvoiceActions({
              invoice,
              selectionMode: false,
            });

            const handleCardClick = () => {
              if (isMultiSelectMode) {
                toggleSelection(invoice.id);
              } else {
                navigate(`/invoices/${invoice.id}`);
              }
            };

            return (
              <Card
                key={invoice.id}
                onClick={handleCardClick}
                data-item={invoice.id}
                className={cn(
                  "card p-3 sm:p-4 md:min-h-[120px] card-hover-polish",
                  !isMultiSelectMode && "cursor-pointer",
                  selectedIds.has(invoice.id) && "item-selected"
                )}
              >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {(() => {
                        const InvoiceIcon = getInvoiceIcon();
                        return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                      })()}
                      <div className="min-w-0">
                        <div className="text-base leading-tight break-words">{displayName}</div>
                        {linkedContact && (
                          <div className="text-xs text-muted-foreground truncate">{linkedContact.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-base font-normal tabular-nums">{displayTotal}</div>
                      {getStatusBadge(invoice)}
                      {invoice.type === "cancellation" && (
                        <Badge variant="outline" className="text-[11px] uppercase tracking-widest font-normal">STORNO</Badge>
                      )}
                      {!isMultiSelectMode && (
                        <ItemActionsMenu
                          actions={availableActions}
                          onAction={(action) => {
                            // Use switch statement to ensure only one action executes
                            switch (action) {
                              case "edit":
                                // "Edit" navigates to invoice detail page
                                navigate(`/invoices/${invoice.id}`);
                                break;
                              case "duplicate":
                                duplicateInvoiceMutation.mutate({ id: invoice.id });
                                break;
                              case "select":
                                setIsMultiSelectMode(true);
                                setSelectedIds(new Set([invoice.id]));
                                break;
                              case "archive":
                                handleArchiveInvoice(invoice.id);
                                break;
                              case "delete":
                                // "Delete" maps to "moveToTrash" for invoices
                                if (isDraft) {
                                  handleMoveToRubbish(invoice.id);
                                } else {
                                  toast.info("Only draft invoices can be deleted. Use Archive for sent invoices.");
                                }
                                break;
                              case "markAsSent":
                                // Check if invoice is already sent - show warning dialog if so
                                if (invoice.sentAt) {
                                  setMarkAsSentTarget({ 
                                    id: invoice.id, 
                                    invoiceNumber: invoice.invoiceNumber,
                                    alreadySent: true 
                                  });
                                  setMarkAsSentDialogOpen(true);
                                } else {
                                  markAsSentMutation.mutate({ id: invoice.id });
                                }
                                break;
                              case "markAsPaid":
                                // Show date picker dialog for payment date
                                setMarkAsPaidTarget({ 
                                  id: invoice.id, 
                                  invoiceNumber: invoice.invoiceNumber,
                                  alsoMarkAsSent: !invoice.sentAt && invoice.source === "uploaded"
                                });
                                setMarkAsPaidDialogOpen(true);
                                break;
                              case "revertToDraft":
                                // Show revert dialog with warning and checkbox requirement
                                setRevertTarget({ 
                                  id: invoice.id, 
                                  targetStatus: "draft", 
                                  currentStatus: "open" 
                                });
                                setRevertDialogOpen(true);
                                break;
                              case "revertToSent":
                                // Show mark as not paid dialog with warning and checkbox requirement
                                setRevertTarget({ 
                                  id: invoice.id, 
                                  targetStatus: "open", 
                                  currentStatus: "paid" 
                                });
                                setRevertDialogOpen(true);
                                break;
                              case "markAsCancelled":
                                markAsCancelledMutation.mutate({ id: invoice.id });
                                break;
                              case "markAsNotCancelled":
                                markAsNotCancelledMutation.mutate({ id: invoice.id });
                                break;
                              default:
                                console.warn("Unknown action:", action);
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Multi-select bar */}
      {isMultiSelectMode && (() => {
        // Get all selected invoices
        const selectedInvoices = Array.from(selectedIds)
          .map(id => [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id))
          .filter(Boolean) as typeof filteredInvoices;
        
        // Use shared action model to determine available actions
        // For multi-select, we show actions that are valid for at least one selected invoice
        const allActions = new Set<ItemAction>();
        selectedInvoices.forEach((invoice) => {
          const actions = getInvoiceActions({ invoice, selectionMode: true });
          actions.forEach(action => allActions.add(action));
        });
        
        // Determine which handlers to provide based on available actions
        const hasMarkAsSent = allActions.has("markAsSent");
        const hasMarkAsPaid = allActions.has("markAsPaid");
        const hasMarkAsCancelled = allActions.has("markAsCancelled");
        const hasMarkAsNotCancelled = allActions.has("markAsNotCancelled");
        const hasRevertToDraft = allActions.has("revertToDraft");
        const hasRevertToSent = allActions.has("revertToSent");
        const hasArchive = allActions.has("archive");
        const hasDuplicate = allActions.has("duplicate");
        const hasDelete = allActions.has("delete");

        return (
          <MultiSelectBar
            selectedCount={selectedIds.size}
            totalCount={filteredInvoices.length + needsReviewInvoices.length}
            onSelectAll={handleSelectAll}
            onDuplicate={hasDuplicate ? handleBatchDuplicate : undefined}
            onMarkAsSent={hasMarkAsSent ? handleBatchMarkAsSent : undefined}
            onRevertToDraft={hasRevertToDraft ? handleBatchRevertToDraft : undefined}
            onRevertToSent={hasRevertToSent ? handleBatchRevertToSent : undefined}
            onMarkAsPaid={hasMarkAsPaid ? handleBatchMarkAsPaid : undefined}
            onMarkAsCancelled={hasMarkAsCancelled ? handleBatchMarkAsCancelled : undefined}
            onMarkAsNotCancelled={hasMarkAsNotCancelled ? handleBatchMarkAsNotCancelled : undefined}
            onArchive={hasArchive ? handleBatchArchive : undefined}
            onDelete={hasDelete ? handleBatchDelete : undefined}
          onCancel={() => {
            // Clear selection and exit multi-select mode
            setSelectedIds(new Set());
            setIsMultiSelectMode(false);
            
            // Clean up any lingering context menu transforms on all invoice items
            // This ensures items slide back down to their original position after canceling multi-select
            // Use requestAnimationFrame to ensure DOM updates happen after React's render
            requestAnimationFrame(() => {
              // Find all invoice cards in the invoices page and remove context menu classes/transforms
              const invoiceCards = document.querySelectorAll('[data-item]');
              invoiceCards.forEach((card) => {
                const element = card as HTMLElement;
                // Remove context menu classes
                element.classList.remove("context-menu-active");
                element.classList.remove("context-menu-shifted");
                element.classList.remove("context-menu-pressing");
                // Remove CSS custom properties that control the transform
                element.style.removeProperty("--context-menu-shift");
                element.style.removeProperty("--context-menu-scale");
                // Force reset transform to ensure item returns to original position
                element.style.transform = "";
              });
            });
          }}
          />
        );
      })()}

      <PDFPreviewModal
        isOpen={previewModalOpen}
        onClose={() => {
          setPreviewModalOpen(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          setPreviewUrl(null);
        }}
        fileUrl={previewUrl ?? undefined}
        fileName={previewFileName}
        fullScreen={isMobile}
      />

      <DeleteConfirmDialog
        open={Boolean(needsReviewDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setNeedsReviewDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (!needsReviewDeleteTarget) return;
          needsReviewDeleteMutation.mutate({ id: needsReviewDeleteTarget.id });
        }}
        title="Delete uploaded invoice"
        description={`Delete "${needsReviewDeleteTarget?.name ?? "this invoice"}"? This will remove the file and cannot be undone.`}
        confirmLabel="Delete"
        isDeleting={needsReviewDeleteMutation.isPending}
      />

      <DeleteConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          setArchiveDialogOpen(open);
          if (!open) {
            setArchiveTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!archiveTargetId) return;
          archiveMutation.mutate({ id: archiveTargetId });
        }}
        title="Archive invoice"
        description="Archive this invoice? You can restore it later from the archived view."
        confirmLabel="Archive"
        isDeleting={archiveMutation.isPending}
      />

      <DeleteConfirmDialog
        open={moveToRubbishDialogOpen}
        onOpenChange={(open) => {
          setMoveToRubbishDialogOpen(open);
          if (!open) {
            setMoveToRubbishTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!moveToRubbishTargetId) return;
          moveToTrashMutation.mutate({ id: moveToRubbishTargetId });
        }}
        title="Delete invoice"
        description="Delete this draft invoice? You can restore it later from the Rubbish."
        confirmLabel="Delete"
        isDeleting={moveToTrashMutation.isPending}
      />

      {/* Single invoice revert dialog */}
      <RevertInvoiceStatusDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        currentStatus={revertTarget?.currentStatus || "open"}
        targetStatus={revertTarget?.targetStatus || "draft"}
        invoiceNumber={revertTarget ? ([...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === revertTarget.id)?.invoiceNumber || null) : null}
        invoiceAmount={revertTarget ? ([...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === revertTarget.id)?.total || null) : null}
        onConfirm={() => {
          if (!revertTarget) return;
          // Use the appropriate mutation based on target status
          if (revertTarget.targetStatus === "draft") {
            revertToDraftMutation.mutate({ id: revertTarget.id, confirmed: true });
          } else {
            revertToSentMutation.mutate({ id: revertTarget.id, confirmed: true });
          }
          setRevertDialogOpen(false);
        }}
        isReverting={revertToDraftMutation.isPending || revertToSentMutation.isPending}
      />
      
      {/* Batch revert dialog - CRITICAL: Batch revert actions MUST show confirmation dialog */}
      <RevertInvoiceStatusDialog
        open={batchRevertDialogOpen}
        onOpenChange={(open) => {
          setBatchRevertDialogOpen(open);
          if (!open) {
            setBatchRevertData(null);
          }
        }}
        currentStatus={batchRevertData?.currentStatus || "open"}
        targetStatus={batchRevertData?.targetStatus || "draft"}
        onConfirm={() => {
          if (!batchRevertData) return;
          if (batchRevertData.targetStatus === "draft") {
            handleConfirmBatchRevertToDraft();
          } else {
            handleConfirmBatchRevertToSent();
          }
        }}
        isReverting={revertToDraftMutation.isPending || revertToSentMutation.isPending}
        isBatch={true}
        batchCount={batchRevertData?.validInvoiceIds.length || 0}
        skippedCount={batchRevertData?.skippedCount || 0}
      />

      <DeleteConfirmDialog
        open={cancellationDialogOpen}
        onOpenChange={(open) => {
          setCancellationDialogOpen(open);
          if (!open) {
            setCancellationTarget(null);
          }
        }}
        onConfirm={() => {
          if (!cancellationTarget) return;
          createCancellationMutation.mutate({ invoiceId: cancellationTarget.id });
        }}
        title="Create cancellation invoice?"
        description={`This will create a new cancellation invoice that reverses invoice ${cancellationTarget?.invoiceNumber ?? ""}. The original invoice will remain unchanged.`}
        confirmLabel="Create cancellation invoice"
        isDeleting={createCancellationMutation.isPending}
      />

      {/* Mark as Paid Dialog */}
      <MarkAsPaidDialog
        open={markAsPaidDialogOpen}
        onOpenChange={(open) => {
          setMarkAsPaidDialogOpen(open);
          if (!open) {
            setMarkAsPaidTarget(null);
          }
        }}
        onConfirm={(paidAt) => {
          if (markAsPaidTarget) {
            markAsPaidMutation.mutate({ 
              id: markAsPaidTarget.id, 
              paidAt,
              alsoMarkAsSent: markAsPaidTarget.alsoMarkAsSent 
            });
          }
        }}
        isProcessing={markAsPaidMutation.isPending}
        invoiceNumber={markAsPaidTarget?.invoiceNumber || undefined}
      />

      {/* Mark as Sent Warning Dialog */}
      <MarkAsSentWarningDialog
        open={markAsSentDialogOpen}
        onOpenChange={(open) => {
          setMarkAsSentDialogOpen(open);
          if (!open) {
            setMarkAsSentTarget(null);
          }
        }}
        invoiceNumber={markAsSentTarget?.invoiceNumber}
        onConfirm={() => {
          if (!markAsSentTarget) return;
          markAsSentMutation.mutate({ id: markAsSentTarget.id, confirmed: true });
        }}
        isProcessing={markAsSentMutation.isPending}
      />

      {/* Bulk Upload Dialog */}
      <BulkInvoiceUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUpload={handleBulkUpload}
        isUploading={bulkUploadMutation.isPending}
      />
    </div>
  );
}
