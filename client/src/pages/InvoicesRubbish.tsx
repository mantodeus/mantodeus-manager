import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Trash2, ArrowLeft, Loader2, FileText, Search, SlidersHorizontal, X, CheckCircle2, Archive } from "@/components/ui/Icon";
import { useState, useEffect, useRef, useMemo } from "react";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useMobile";

function formatCurrency(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(num || 0);
}

const monthDisplayNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type FilterState = {
  project: string;
  client: string;
  time: string; // "all" | "2024" | "2024-10" (year-month format)
};

const defaultFilters: FilterState = {
  project: "all",
  client: "all",
  time: "all",
};

export default function InvoicesRubbish() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();
  const { data: trashedInvoices = [], isLoading } = trpc.invoices.listTrashed.useQuery();
  const { data: contacts = [] } = trpc.contacts.list.useQuery();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const utils = trpc.useUtils();
  const restoreMutation = trpc.invoices.restore.useMutation({
    onSuccess: () => {
      toast.success("Invoice restored");
      utils.invoices.listTrashed.invalidate();
      utils.invoices.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Invoice deleted permanently");
      utils.invoices.listTrashed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  
  // Empty rubbish dialog
  const [emptyRubbishDialogOpen, setEmptyRubbishDialogOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

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

      return matchesSearch && matchesProject && matchesClient && matchesTime;
    });
  };

  const filteredInvoices = useMemo(() => filterInvoices(trashedInvoices), [trashedInvoices, searchQuery, filters, contacts]);

  const getStatusBadge = (invoice: any) => {
    const { status, sentAt, paidAt, dueDate } = invoice;

    if (status === 'paid') {
      return <Badge variant="outline" className="text-xs !bg-pink-500 !text-white dark:!bg-[#00FF88] dark:!text-black !border-pink-500/50 dark:!border-[#00FF88]/50">PAID</Badge>;
    }

    if (status === 'open' && sentAt) {
      if (dueDate && new Date(dueDate) < new Date() && !paidAt) {
        return <Badge variant="destructive" className="text-xs">OVERDUE</Badge>;
      }
      return <Badge variant="default" className="text-xs bg-blue-500 text-white dark:bg-blue-600 dark:text-white border-blue-500/50">SENT</Badge>;
    }

    if (status === 'open' && !sentAt) {
      return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">NOT SENT</Badge>;
    }

    return <Badge variant="outline" className="text-xs">DRAFT</Badge>;
  };

  const handleItemAction = (action: ItemAction, invoiceId: number, status: string) => {
    switch (action) {
      case "restore":
        restoreMutation.mutate({ id: invoiceId });
        break;
      case "deletePermanently":
        if (status !== "draft") return;
        setDeleteTargetId(invoiceId);
        setDeleteDialogOpen(true);
        break;
    }
  };

  const handleEmptyRubbish = () => {
    if (trashedInvoices.length === 0) return;
    
    // Delete all draft invoices one by one
    trashedInvoices.forEach((invoice) => {
      if (invoice.status === "draft") {
        deleteMutation.mutate({ id: invoice.id });
      }
    });
    
    setEmptyRubbishDialogOpen(false);
  };

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
                              navigate(`/invoices/${invoice.id}`);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasActiveFilters = filters.project !== "all" || filters.client !== "all" || filters.time !== "all" || searchQuery !== "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rubbish"
        subtitle="Deleted invoices. Items here can be restored or permanently deleted."
        leading={
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
        }
        actions={
          filteredInvoices.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setEmptyRubbishDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Empty
            </Button>
          ) : undefined
        }
        actionsPlacement="right"
        searchSlot={searchSlot}
        filterSlot={filterSlot}
      />

      {filteredInvoices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? "No deleted invoices found matching your filters"
              : "Rubbish is empty."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInvoices.map((invoice) => {
            const linkedContact = contacts.find(
              (contact: { id: number }) => contact.id === invoice.clientId || contact.id === invoice.contactId
            );
            const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : null;
            const displayName = invoice.invoiceName || invoice.invoiceNumber || "Untitled invoice";
            const displayTotal = formatCurrency(invoice.total);
            const actions: ItemAction[] =
              invoice.status === "draft" ? ["restore", "deletePermanently"] : ["restore"];

            return (
              <Card key={invoice.id} className="p-3 sm:p-4 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-accent mt-0.5 shrink-0" />
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
                    <ItemActionsMenu
                      actions={actions}
                      onAction={(action) => handleItemAction(action, invoice.id, invoice.status)}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={() => {
          if (!deleteTargetId) return;
          deleteMutation.mutate({ id: deleteTargetId });
        }}
        title="Delete permanently"
        description="This action is PERMANENT and cannot be undone. The invoice will be deleted forever."
        confirmLabel="Delete permanently"
        isDeleting={deleteMutation.isPending}
      />

      <DeleteConfirmDialog
        open={emptyRubbishDialogOpen}
        onOpenChange={(open) => {
          setEmptyRubbishDialogOpen(open);
        }}
        onConfirm={handleEmptyRubbish}
        title="Empty rubbish"
        description={`This will permanently delete all draft invoices in the rubbish (${filteredInvoices.filter(i => i.status === "draft").length} draft invoice(s)). This action cannot be undone.`}
        confirmLabel="Empty rubbish"
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
