import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Loader2, Upload, DocumentCurrencyEuro, DocumentCurrencyPound, Search, SlidersHorizontal, X } from "@/components/ui/Icon";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ScrollRevealFooter } from "@/components/ScrollRevealFooter";
import { PageHeader } from "@/components/PageHeader";
import { RevertInvoiceStatusDialog } from "@/components/RevertInvoiceStatusDialog";
import { InvoiceUploadReviewDialog } from "@/components/InvoiceUploadReviewDialog";
import { useIsMobile } from "@/hooks/useMobile";
import { PDFPreviewModal } from "@/components/PDFPreviewModal";
import { Link, useLocation } from "wouter";
import { MultiSelectBar, createArchiveAction, createDeleteAction } from "@/components/MultiSelectBar";
import { BulkInvoiceUploadDialog } from "@/components/invoices/BulkInvoiceUploadDialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  time: "all" | "week" | "month" | "year";
};

const defaultFilters: FilterState = {
  project: "all",
  client: "all",
  time: "all",
};

// Month names for date search
const monthNames = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

export default function Invoices() {
  const isMobile = useIsMobile();
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

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: invoices = [], refetch } = trpc.invoices.list.useQuery();
  const { data: needsReviewInvoices = [], refetch: refetchNeedsReview } = trpc.invoices.listNeedsReview.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const { data: companySettings } = trpc.settings.get.useQuery();
  const issueMutation = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Invoice sent");
      refetch();
      refetchNeedsReview();
    },
    onError: (err) => toast.error(err.message),
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
    if (isFilterOpen) {
      setDraftFilters(filters);
    }
  }, [isFilterOpen, filters]);

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

  const clearDraftFilters = () => {
    setDraftFilters(defaultFilters);
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setIsFilterOpen(false);
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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const lastWeek = new Date(startOfToday);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const lastMonth = new Date(startOfToday);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastYear = new Date(startOfToday);
    lastYear.setFullYear(lastYear.getFullYear() - 1);

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

      // Time filter (based on issueDate)
      const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
      const matchesTime =
        filters.time === "all" ||
        (issueDate &&
          ((filters.time === "week" && issueDate >= lastWeek) ||
           (filters.time === "month" && issueDate >= lastMonth) ||
           (filters.time === "year" && issueDate >= lastYear)));

      return matchesSearch && matchesProject && matchesClient && matchesTime;
    });
  };

  const filteredInvoices = filterInvoices(invoices);

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
    const { status, sentAt, paidAt } = invoice;

    if (paidAt) {
      return <Badge variant="secondary" className="text-xs">PAID</Badge>;
    }

    if (sentAt) {
      return <Badge variant="default" className="text-xs">OPEN</Badge>;
    }

    if (status === 'draft') {
      return <Badge variant="outline" className="text-xs">DRAFT</Badge>;
    }

    return <Badge variant="outline" className="text-xs">OPEN</Badge>;
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
    filters.time !== "all";

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
                              if (invoice.source === "uploaded" && invoice.status === "draft") {
                                setUploadedInvoiceId(invoice.id);
                                setUploadedParsedData(null);
                                setUploadReviewDialogOpen(true);
                              } else {
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
              value={draftFilters.project}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, project: value }))
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
              value={draftFilters.client}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, client: value }))
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
              value={draftFilters.time}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  time: value as FilterState["time"],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any time</SelectItem>
                <SelectItem value="week">Last week</SelectItem>
                <SelectItem value="month">Last month</SelectItem>
                <SelectItem value="year">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex-1" onClick={clearDraftFilters}>
              Clear all
            </Button>
            <Button className="flex-1" onClick={applyFilters}>
              Apply filters
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Create, edit, and manage invoices"
        searchSlot={searchSlot}
        filterSlot={filterSlot}
      />

      {/* Top-of-Page Action Row */}
      <div className="flex items-center justify-end gap-2 pb-2 border-b">
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
        <Button asChild className="h-10 whitespace-nowrap">
          <Link href="/invoices/new">
            <Plus className="w-4 h-4 mr-1" />
            New
          </Link>
        </Button>
      </div>

      {needsReviewInvoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Needs Review</h2>
            <Badge variant="secondary" className="text-xs">
              {needsReviewInvoices.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsReviewInvoices.map((invoice) => {
              const uploadDate = invoice.uploadedAt || invoice.uploadDate || invoice.createdAt;
              const uploadDateLabel = uploadDate ? new Date(uploadDate).toLocaleDateString("de-DE") : "Unknown date";
              const displayName =
                invoice.invoiceName ||
                (invoice.filename ? invoice.filename.replace(/\.[^/.]+$/, "") : null) ||
                "Untitled invoice";
              const displayTotal = formatCurrency(invoice.total);
              return (
                <div
                  key={`needs-review-${invoice.id}`}
                  onClick={() => {
                    if (isMultiSelectMode) {
                      toggleSelection(invoice.id);
                    }
                  }}
                  className={`${isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(invoice.id) ? "item-selected rounded-lg" : ""}`}
                >
                  <Card className="p-3 sm:p-4 hover:shadow-sm transition-all">
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
                            actions={["edit", "duplicate", "select", "archive", "delete"]}
                            onAction={(action) => {
                              if (action === "edit") {
                                // "Edit" maps to "review" for needs-review invoices
                                setUploadedInvoiceId(invoice.id);
                                setUploadedParsedData(null);
                                setUploadReviewDialogOpen(true);
                              }
                              if (action === "duplicate") {
                                duplicateInvoiceMutation.mutate({ id: invoice.id });
                              }
                              if (action === "select") {
                                setIsMultiSelectMode(true);
                                setSelectedIds(new Set([invoice.id]));
                              }
                              if (action === "archive") {
                                handleArchiveInvoice(invoice.id);
                              }
                              if (action === "delete") {
                                setNeedsReviewDeleteTarget({ id: invoice.id, name: displayName });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            const availableActions: ItemAction[] = ["edit", "duplicate", "select", "archive", "delete"];

            const handleCardClick = () => {
              if (isMultiSelectMode) {
                toggleSelection(invoice.id);
              } else {
                // For uploaded invoices that have been saved once (draft mode), open review dialog
                if (invoice.source === "uploaded" && invoice.status === "draft") {
                  setUploadedInvoiceId(invoice.id);
                  setUploadedParsedData(null);
                  setUploadReviewDialogOpen(true);
                } else {
                  navigate(`/invoices/${invoice.id}`);
                }
              }
            };

            return (
              <div
                key={invoice.id}
                onClick={handleCardClick}
                className={`${isMultiSelectMode ? "cursor-pointer" : ""} ${selectedIds.has(invoice.id) ? "item-selected rounded-lg" : ""}`}
              >
                <Card className="p-3 sm:p-4 hover:shadow-sm transition-all md:min-h-[120px]">
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
                            if (action === "edit") {
                              // "Edit" navigates to invoice detail page
                              navigate(`/invoices/${invoice.id}`);
                            }
                            if (action === "duplicate") {
                              duplicateInvoiceMutation.mutate({ id: invoice.id });
                            }
                            if (action === "select") {
                              setIsMultiSelectMode(true);
                              setSelectedIds(new Set([invoice.id]));
                            }
                            if (action === "archive") {
                              handleArchiveInvoice(invoice.id);
                            }
                            if (action === "delete") {
                              // "Delete" maps to "moveToTrash" for invoices
                              if (isDraft) {
                                handleMoveToRubbish(invoice.id);
                              } else {
                                toast.info("Only draft invoices can be deleted. Use Archive for sent invoices.");
                              }
                            }
                          }}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Multi-select bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          totalCount={filteredInvoices.length + needsReviewInvoices.length}
          onSelectAll={handleSelectAll}
          onDuplicate={handleBatchDuplicate}
          onArchive={handleBatchArchive}
          onDelete={handleBatchDelete}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      <ScrollRevealFooter basePath="/invoices" />

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
