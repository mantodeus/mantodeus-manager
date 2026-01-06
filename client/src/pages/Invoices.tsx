import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Loader2, Upload, DocumentCurrencyEuro, DocumentCurrencyPound, Search, SlidersHorizontal, X, CheckCircle2, Archive, Trash2 } from "@/components/ui/Icon";
import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "sonner";
import { getInvoiceState, getDerivedValues } from "@/lib/invoiceState";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { MarkAsSentWarningDialog } from "@/components/MarkAsSentWarningDialog";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
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
  yearTotal, 
  allYearTotals, 
  onYearSelect,
  popoverOpen,
  onPopoverOpenChange 
}: { 
  selectedYear: number;
  yearTotal: number;
  allYearTotals: Array<{ year: number; total: number }>;
  onYearSelect: (year: number) => void;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  
  const { longPressHandlers } = useLongPress({
    onLongPress: (e) => {
      e.preventDefault();
      if (cardRef.current) {
        setCardRect(cardRef.current.getBoundingClientRect());
      }
      onPopoverOpenChange(true);
    },
    duration: 550,
  });

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

  // Update card rect when popover opens
  useEffect(() => {
    if (popoverOpen && cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    }
  }, [popoverOpen]);

  // Calculate menu position
  const menuStyle = useMemo(() => {
    if (!cardRect) return null;
    
    return {
      position: 'fixed' as const,
      left: `${cardRect.left + cardRect.width / 2}px`,
      top: `${cardRect.bottom + 8}px`,
      transform: 'translateX(-50%)',
    };
  }, [cardRect]);

  const selectedYearData = allYearTotals.find(y => y.year === selectedYear);
  const otherYears = allYearTotals.filter(y => y.year !== selectedYear);

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "p-4 has-context-menu cursor-pointer",
          popoverOpen && "context-menu-active"
        )}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors">
            Total {selectedYear}
          </span>
          <span className="text-xl font-semibold">
            {formatCurrency(yearTotal)}
          </span>
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
              animation: "contextMenuIn 140ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              pointerEvents: "auto",
              maxHeight: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {/* Current selection at top */}
              {selectedYearData && (
                <div className="glass-menu-item bg-accent/30 px-3 py-2 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total {selectedYearData.year}</span>
                    <span className="text-sm font-semibold">{formatCurrency(selectedYearData.total)}</span>
                  </div>
                </div>
              )}
              
              {/* Other years */}
              {otherYears.map(({ year, total }) => (
                <button
                  key={year}
                  onClick={() => {
                    onYearSelect(year);
                    onPopoverOpenChange(false);
                  }}
                  className="glass-menu-item w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                  style={{ border: 'none' }}
                >
                  <span className="text-sm font-medium">Total {year}</span>
                  <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                </button>
              ))}
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
  quarterTotal, 
  allQuarterTotals, 
  onQuarterSelect,
  popoverOpen,
  onPopoverOpenChange 
}: { 
  selectedQuarter: { quarter: number; year: number };
  quarterTotal: number;
  allQuarterTotals: Array<{ key: string; quarter: number; year: number; total: number }>;
  onQuarterSelect: (quarter: number, year: number) => void;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  
  const { longPressHandlers } = useLongPress({
    onLongPress: (e) => {
      e.preventDefault();
      if (cardRef.current) {
        setCardRect(cardRef.current.getBoundingClientRect());
      }
      onPopoverOpenChange(true);
    },
    duration: 550,
  });

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

  // Update card rect when popover opens
  useEffect(() => {
    if (popoverOpen && cardRef.current) {
      setCardRect(cardRef.current.getBoundingClientRect());
    }
  }, [popoverOpen]);

  // Calculate menu position
  const menuStyle = useMemo(() => {
    if (!cardRect) return null;
    
    return {
      position: 'fixed' as const,
      left: `${cardRect.left + cardRect.width / 2}px`,
      top: `${cardRect.bottom + 8}px`,
      transform: 'translateX(-50%)',
    };
  }, [cardRect]);

  const selectedQuarterData = allQuarterTotals.find(
    q => q.year === selectedQuarter.year && q.quarter === selectedQuarter.quarter
  );
  const otherQuarters = allQuarterTotals.filter(
    q => !(q.year === selectedQuarter.year && q.quarter === selectedQuarter.quarter)
  );

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "p-4 has-context-menu cursor-pointer",
          popoverOpen && "context-menu-active"
        )}
        {...longPressHandlers}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors">
            Q{selectedQuarter.quarter} {selectedQuarter.year}
          </span>
          <span className="text-xl font-semibold">
            {formatCurrency(quarterTotal)}
          </span>
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
              animation: "contextMenuIn 140ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              overflowY: "auto",
              overscrollBehavior: "contain",
              pointerEvents: "auto",
              maxHeight: "300px",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {/* Current selection at top */}
              {selectedQuarterData && (
                <div className="glass-menu-item bg-accent/30 px-3 py-2 rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{selectedQuarterData.key}</span>
                    <span className="text-sm font-semibold">{formatCurrency(selectedQuarterData.total)}</span>
                  </div>
                </div>
              )}
              
              {/* Other quarters */}
              {otherQuarters.map(({ key, quarter, year, total }) => (
                <button
                  key={key}
                  onClick={() => {
                    onQuarterSelect(quarter, year);
                    onPopoverOpenChange(false);
                  }}
                  className="glass-menu-item w-full text-left flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                  style={{ border: 'none' }}
                >
                  <span className="text-sm font-medium">{key}</span>
                  <span className="text-sm font-semibold">{formatCurrency(total)}</span>
                </button>
              ))}
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
  const [markAsSentDialogOpen, setMarkAsSentDialogOpen] = useState(false);
  const [markAsSentTarget, setMarkAsSentTarget] = useState<{ id: number; invoiceNumber?: string | null; alreadySent: boolean } | null>(null);
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);
  const [cancellationTarget, setCancellationTarget] = useState<{ id: number; invoiceNumber: string } | null>(null);
  const [needsReviewDeleteTarget, setNeedsReviewDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [uploadReviewDialogOpen, setUploadReviewDialogOpen] = useState(false);
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState<number | null>(null);
  const [uploadedParsedData, setUploadedParsedData] = useState<{
    clientName: string | null;
    invoiceDate: Date | null;
    totalAmount: string | null;
    invoiceNumber: string | null;
  } | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
    },
    onError: (err) => toast.error(err.message),
  });
  const moveToTrashMutation = trpc.invoices.moveToTrash.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted");
      refetch();
      refetchNeedsReview();
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
      toast.success("Invoice reverted to sent");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
  });
  const uploadInvoiceMutation = trpc.invoices.uploadInvoice.useMutation({
    onSuccess: (data) => {
      setUploadedInvoiceId(data.invoice.id);
      setUploadedParsedData(data.parsedData);
      setUploadReviewDialogOpen(true);
    },
    onError: (err) => {
      toast.error("Failed to upload invoice: " + err.message);
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
  const { yearTotal, quarterTotal, allYearTotals, allQuarterTotals } = useMemo(() => {
    // Use selected year/quarter for display
    const displayYear = selectedYear;
    const displayQuarter = selectedQuarter.quarter;
    const displayQuarterYear = selectedQuarter.year;
    
    const quarterStart = new Date(displayQuarterYear, (displayQuarter - 1) * 3, 1);
    const quarterEnd = new Date(displayQuarterYear, displayQuarter * 3, 0, 23, 59, 59);

    let yearSum = 0;
    let quarterSum = 0;
    const yearTotalsMap = new Map<number, number>();
    const quarterTotalsMap = new Map<string, number>();

    allInvoices.forEach((invoice) => {
      // Only count active invoices (not archived or deleted)
      if (invoice._status !== 'active') return;
      
      // Only count sent/paid invoices (not drafts)
      if (!invoice.sentAt && !invoice.paidAt) return;

      const total = parseFloat(invoice.total?.toString() || '0');
      if (isNaN(total)) return;

      const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
      if (!issueDate) return;

      const invoiceYear = issueDate.getFullYear();
      const invoiceQuarter = Math.floor(issueDate.getMonth() / 3) + 1;
      const quarterKey = `Q${invoiceQuarter} ${invoiceYear}`;

      // Add to year totals
      const existingYearTotal = yearTotalsMap.get(invoiceYear) || 0;
      yearTotalsMap.set(invoiceYear, existingYearTotal + total);

      // Add to quarter totals
      const existingQuarterTotal = quarterTotalsMap.get(quarterKey) || 0;
      quarterTotalsMap.set(quarterKey, existingQuarterTotal + total);

      // Selected year and quarter
      if (invoiceYear === displayYear) {
        yearSum += total;
      }
      if (invoiceYear === displayQuarterYear && issueDate >= quarterStart && issueDate <= quarterEnd) {
        quarterSum += total;
      }
    });

    // Convert maps to sorted arrays
    const allYears = Array.from(yearTotalsMap.keys()).sort((a, b) => b - a);
    const allYearTotals = allYears.map(year => ({
      year,
      total: yearTotalsMap.get(year) || 0
    }));

    // Convert quarter map to sorted array (by year desc, then quarter desc)
    const allQuarters = Array.from(quarterTotalsMap.entries())
      .map(([key, total]) => {
        const match = key.match(/Q(\d+) (\d+)/);
        if (!match) return null;
        return {
          key,
          quarter: parseInt(match[1], 10),
          year: parseInt(match[2], 10),
          total
        };
      })
      .filter((q): q is { key: string; quarter: number; year: number; total: number } => q !== null)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.quarter - a.quarter;
      });

    return {
      yearTotal: yearSum,
      quarterTotal: quarterSum,
      allYearTotals,
      allQuarterTotals: allQuarters,
    };
  }, [allInvoices, selectedYear, selectedQuarter]);

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
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      markAsPaidMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchRevertToDraft = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      revertToDraftMutation.mutate({ id, confirmed: true });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchRevertToSent = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      revertToSentMutation.mutate({ id, confirmed: true });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBulkUpload = async (files: File[]) => {
    try {
      // Convert files to base64
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

      bulkUploadMutation.mutate({ files: fileData });
    } catch (error) {
      toast.error("Failed to process files");
    }
  };

  const getStatusBadge = (invoice: any) => {
    const invoiceState = getInvoiceState(invoice);
    const derivedValues = getDerivedValues(invoice);
    
    // Badge priority: OVERDUE > PARTIAL > SENT/PAID
    if (derivedValues.isOverdue) {
      return <Badge variant="destructive" className="text-xs">OVERDUE</Badge>;
    }
    
    if (invoiceState === 'PARTIAL') {
      return <Badge variant="default" className="text-xs bg-orange-500 text-white dark:bg-orange-600 dark:text-white border-orange-500/50">PARTIAL</Badge>;
    }
    
    if (invoiceState === 'PAID') {
      return (
        <span 
          className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0"
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
      return <Badge variant="default" className="text-xs bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-blue-500/50">SENT</Badge>;
    }
    
    if (invoiceState === 'DRAFT') {
      return <Badge variant="outline" className="text-xs">DRAFT</Badge>;
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

  // Search overlay - full screen at top on mobile
  const searchSlot = (
    <>
      {isSearchOpen && (
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
                              // ALL uploaded invoices use review dialog (never full InvoiceForm)
                              if (invoice.source === "uploaded") {
                                setUploadedInvoiceId(invoice.id);
                                setUploadedParsedData(null);
                                setUploadReviewDialogOpen(true);
                              } else {
                                // Created invoices navigate to detail page (full InvoiceForm)
                                navigate(`/invoices/${invoice.id}`);
                              }
                              setIsSearchOpen(false);
                            }}
                          >
                            <div className="font-medium">{displayName}</div>
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
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Search invoices"
        onClick={() => setIsSearchOpen(true)}
      >
        <Search className="size-6" />
      </Button>
    </>
  );

  const filterSlot = (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Filter invoices">
          <SlidersHorizontal className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-y-auto space-y-4 pt-4">
          {/* Project Filter */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Project</div>
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
            <div className="text-sm font-medium">Client</div>
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
            <div className="text-sm font-medium">Time</div>
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
            <div className="text-sm font-medium">Status</div>
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
      <PageHeader
        title="Invoices"
        subtitle="Create, edit, and manage invoices"
        actionsPlacement="right"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setBulkUploadOpen(true)}
              disabled={bulkUploadMutation.isPending}
              className="h-10 whitespace-nowrap"
            >
              {bulkUploadMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload
            </Button>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              className="h-10 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </>
        }
        searchSlot={searchSlot}
        filterSlot={filterSlot}
      />

      {/* Total Cards */}
      <div className="grid gap-3 md:grid-cols-2">
        <YearTotalCard
          selectedYear={selectedYear}
          yearTotal={yearTotal}
          allYearTotals={allYearTotals}
          onYearSelect={(year) => setSelectedYear(year)}
          popoverOpen={yearPopoverOpen}
          onPopoverOpenChange={setYearPopoverOpen}
        />
        <QuarterTotalCard
          selectedQuarter={selectedQuarter}
          quarterTotal={quarterTotal}
          allQuarterTotals={allQuarterTotals}
          onQuarterSelect={(quarter, year) => setSelectedQuarter({ quarter, year })}
          popoverOpen={quarterPopoverOpen}
          onPopoverOpenChange={setQuarterPopoverOpen}
        />
      </div>

      {needsReviewInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Needs Review</h2>
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
              
              const handleNeedsReviewClick = () => {
                if (isMultiSelectMode) {
                  toggleSelection(invoice.id);
                } else {
                  // Instantly open review dialog for uploaded invoices
                  setUploadedInvoiceId(invoice.id);
                  setUploadedParsedData(null);
                  setUploadReviewDialogOpen(true);
                }
              };
              
              return (
                <Card
                  key={`needs-review-${invoice.id}`}
                  onClick={handleNeedsReviewClick}
                  data-item={invoice.id}
                  className={`card p-3 sm:p-4 hover:shadow-sm transition-shadow md:min-h-[120px] ${!isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(invoice.id) ? "item-selected" : ""}`}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {(() => {
                          const InvoiceIcon = getInvoiceIcon();
                          return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                        })()}
                        <div className="min-w-0">
                          <div className="font-light text-base leading-tight break-words">{displayName}</div>
                          <div className="text-xs text-muted-foreground">Uploaded {uploadDateLabel}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-sm font-light">{displayTotal}</div>
                        <Badge variant="outline" className="text-xs">NEEDS REVIEW</Badge>
                        <Badge variant="secondary" className="text-xs">UPLOADED</Badge>
                        {!isMultiSelectMode && (
                          <ItemActionsMenu
                            actions={["edit", "duplicate", "select", "archive", "delete", "markAsSent", "markAsPaid"]}
                            onAction={(action) => {
                              // Use switch statement to ensure only one action executes
                              switch (action) {
                                case "edit":
                                  // "Edit" maps to "review" for needs-review invoices
                                  setUploadedInvoiceId(invoice.id);
                                  setUploadedParsedData(null);
                                  setUploadReviewDialogOpen(true);
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
                                  // CRITICAL: Only call markAsPaid mutation
                                  // For uploaded invoices that haven't been sent, mark as sent and paid
                                  markAsPaidMutation.mutate({ id: invoice.id, alsoMarkAsSent: true });
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
              onClick={() => setCreateDialogOpen(true)}
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
            // Use standard menu actions - map invoice-specific actions to standard ones
            // Add markAsSent and markAsPaid based on invoice state
            const invoiceState = getInvoiceState(invoice);
            const availableActions: ItemAction[] = ["edit", "duplicate", "select", "archive", "delete"];
            if (!invoice.sentAt) {
              availableActions.push("markAsSent");
            }
            if (!invoice.paidAt) {
              availableActions.push("markAsPaid");
            }
            // Add revert actions based on invoice state
            if (invoiceState === 'SENT' || invoiceState === 'PARTIAL') {
              availableActions.push("revertToDraft");
            }
            if (invoiceState === 'PAID') {
              availableActions.push("revertToSent");
            }

            const handleCardClick = () => {
              if (isMultiSelectMode) {
                toggleSelection(invoice.id);
              } else {
                // ALL uploaded invoices use review dialog (never full InvoiceForm)
                if (invoice.source === "uploaded") {
                  setUploadedInvoiceId(invoice.id);
                  setUploadedParsedData(null);
                  setUploadReviewDialogOpen(true);
                } else {
                  // Created invoices navigate to detail page (full InvoiceForm)
                  navigate(`/invoices/${invoice.id}`);
                }
              }
            };

            return (
              <Card
                key={invoice.id}
                onClick={handleCardClick}
                data-item={invoice.id}
                className={`card p-3 sm:p-4 hover:shadow-sm transition-shadow md:min-h-[120px] ${!isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(invoice.id) ? "item-selected" : ""}`}
              >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {(() => {
                        const InvoiceIcon = getInvoiceIcon();
                        return <InvoiceIcon className="w-5 h-5 text-accent mt-0.5 shrink-0" />;
                      })()}
                      <div className="min-w-0">
                        <div className="font-light text-base leading-tight break-words">{displayName}</div>
                        {linkedContact && (
                          <div className="text-xs text-muted-foreground truncate">{linkedContact.name}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {issueDate ? issueDate.toLocaleDateString("de-DE") : "No date"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-sm font-light">{displayTotal}</div>
                      {getStatusBadge(invoice)}
                      {invoice.type === "cancellation" && (
                        <Badge variant="outline" className="text-xs">STORNO</Badge>
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
                                // CRITICAL: Only call markAsPaid mutation
                                // For uploaded invoices that haven't been sent, mark as sent and paid
                                if (!invoice.sentAt && invoice.source === "uploaded") {
                                  markAsPaidMutation.mutate({ id: invoice.id, alsoMarkAsSent: true });
                                } else {
                                  markAsPaidMutation.mutate({ id: invoice.id });
                                }
                                break;
                              case "revertToDraft":
                                // Show revert dialog - for now, directly revert with confirmation
                                revertToDraftMutation.mutate({ id: invoice.id, confirmed: true });
                                break;
                              case "revertToSent":
                                // Show revert dialog - for now, directly revert with confirmation
                                revertToSentMutation.mutate({ id: invoice.id, confirmed: true });
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
        // Determine which batch actions to show based on selected invoices' states
        const selectedInvoiceStates = Array.from(selectedIds).map(id => {
          const invoice = [...filteredInvoices, ...needsReviewInvoices].find(inv => inv.id === id);
          return invoice ? getInvoiceState(invoice) : null;
        }).filter(Boolean) as string[];

        const hasSent = selectedInvoiceStates.some(s => s === 'SENT' || s === 'PARTIAL');
        const hasPaid = selectedInvoiceStates.some(s => s === 'PAID');
        const hasNotSent = selectedInvoiceStates.some(s => !s || s === 'DRAFT' || s === 'REVIEW');
        const hasNotPaid = selectedInvoiceStates.some(s => s !== 'PAID');
        
        // Only show "Mark as sent" if there are non-sent invoices AND no paid invoices
        // If paid invoices are selected, only show "Revert to sent"
        const canMarkAsSent = hasNotSent && !hasPaid;

        return (
          <MultiSelectBar
            selectedCount={selectedIds.size}
            totalCount={filteredInvoices.length + needsReviewInvoices.length}
            onSelectAll={handleSelectAll}
            onDuplicate={handleBatchDuplicate}
            onMarkAsSent={canMarkAsSent ? handleBatchMarkAsSent : undefined}
            onRevertToDraft={hasSent ? handleBatchRevertToDraft : undefined}
            onRevertToSent={hasPaid ? handleBatchRevertToSent : undefined}
            onMarkAsPaid={hasNotPaid ? handleBatchMarkAsPaid : undefined}
            onArchive={handleBatchArchive}
            onDelete={handleBatchDelete}
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

      <InvoiceUploadReviewDialog
        open={uploadReviewDialogOpen}
        onOpenChange={(open) => {
          setUploadReviewDialogOpen(open);
          if (!open) {
            setUploadedInvoiceId(null);
            setUploadedParsedData(null);
          }
        }}
        invoiceId={uploadedInvoiceId}
        parsedData={uploadedParsedData}
        onSuccess={() => {
          refetch();
          refetchNeedsReview();
        }}
      />

      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch();
          refetchNeedsReview();
        }}
      />

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

      <RevertInvoiceStatusDialog
        open={revertDialogOpen}
        onOpenChange={setRevertDialogOpen}
        currentStatus={revertTarget?.currentStatus || "open"}
        targetStatus={revertTarget?.targetStatus || "draft"}
        onConfirm={() => {
          if (!revertTarget) return;
          revertMutation.mutate({
            id: revertTarget.id,
            targetStatus: revertTarget.targetStatus,
            confirmed: true,
          });
          setRevertDialogOpen(false);
        }}
        isReverting={revertMutation.isPending}
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
