/**
 * Expenses List Page
 * 
 * Displays all expenses with:
 * - Header cards showing deductible costs (year and current quarter)
 * - Sections: "Needs Review" and "In Order"
 * - Excludes void expenses by default
 * - Card actions: Edit, Mark as In Order, Void
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Loader2, Receipt } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ExpenseCard } from "@/components/expenses/ExpenseCard";
import { ReviewExpenseCard } from "@/components/expenses/ReviewExpenseCard";
import { StickyReviewActions } from "@/components/expenses/StickyReviewActions";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencyFormat";
import { VoidExpenseDialog } from "@/components/expenses/VoidExpenseDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { CaptureFab } from "@/components/expenses/CaptureFab";
import { BulkUploadDialog } from "@/components/expenses/BulkUploadDialog";

export default function Expenses() {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [showVoid, setShowVoid] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [, navigate] = useLocation();

  const { data: expenses = [], isLoading } = trpc.expenses.list.useQuery({
    includeVoid: showVoid,
  });

  const utils = trpc.useUtils();

  // Calculate deductible amounts
  const { yearDeductible, quarterDeductible } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    const quarterStart = new Date(currentYear, (currentQuarter - 1) * 3, 1);
    const quarterEnd = new Date(currentYear, currentQuarter * 3, 0, 23, 59, 59);

    let yearTotal = 0;
    let quarterTotal = 0;

    expenses.forEach((expense) => {
      if (expense.status === "void") return;

      const deductibleCents = Math.round(
        (expense.grossAmountCents * expense.businessUsePct) / 100
      );

      const expenseDate = new Date(expense.expenseDate);
      if (expenseDate.getFullYear() === currentYear) {
        yearTotal += deductibleCents;
        if (expenseDate >= quarterStart && expenseDate <= quarterEnd) {
          quarterTotal += deductibleCents;
        }
      }
    });

    return {
      yearDeductible: yearTotal,
      quarterDeductible: quarterTotal,
    };
  }, [expenses]);

  // Filter and sort expenses by status
  // Needs Review sorted by createdAt DESC (newest first - inbox behavior)
  const needsReview = expenses
    .filter((e) => e.status === "needs_review")
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // DESC
    });
  const inOrder = expenses.filter((e) => e.status === "in_order");

  const markInOrderMutation = trpc.expenses.setExpenseStatus.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Expense marked as in order");
      utils.expenses.list.invalidate();
      utils.expenses.getExpense.invalidate({ id: variables.id });
      setExpandedExpenseId(null); // Close expanded card
    },
    onError: (err) => {
      toast.error(err.message || "Failed to mark expense as in order");
    },
  });

  const voidMutation = trpc.expenses.setExpenseStatus.useMutation({
    onSuccess: () => {
      toast.success("Expense voided");
      setVoidDialogOpen(false);
      setVoidTargetId(null);
      utils.expenses.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to void expense");
    },
  });

  const deleteMutation = trpc.expenses.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success("Expense deleted");
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      utils.expenses.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete expense");
    },
  });

  const applyFieldMutation = trpc.expenses.applyProposedFields.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Field applied");
      utils.expenses.list.invalidate();
      utils.expenses.getExpense.invalidate({ id: variables.id });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply field");
    },
  });

  const applyAllMutation = trpc.expenses.applyProposedFields.useMutation({
    onSuccess: (_, variables) => {
      toast.success("All fields applied");
      utils.expenses.list.invalidate();
      utils.expenses.getExpense.invalidate({ id: variables.id });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply fields");
    },
  });

  const bulkUploadMutation = trpc.expenses.uploadReceiptsBulk.useMutation({
    onSuccess: async (data) => {
      const createdIds = data.createdExpenseIds || [];
      const errorCount = data.errors?.length || 0;

      if (errorCount > 0) {
        const successCount = createdIds.length;
        toast.error(
          `Uploaded ${successCount} receipt${successCount === 1 ? "" : "s"} with ${errorCount} failure${errorCount === 1 ? "" : "s"}`
        );
      } else {
        toast.success("Receipts uploaded successfully");
      }

      setBulkUploadOpen(false);
      // Force refetch to ensure UI updates immediately (autofill may have run)
      await utils.expenses.list.invalidate();
      // Invalidate individual expense queries to get autofilled data
      if (createdIds.length > 0) {
        await Promise.all(
          createdIds.map((id) => utils.expenses.getExpense.invalidate({ id }))
        );
      }
      navigate("/expenses");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload receipts");
    },
  });

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

  const handleAction = (action: ItemAction, expenseId: number) => {
    if (action === "edit") {
      navigate(`/expenses/${expenseId}`);
      return;
    }
    if (action === "markAsInOrder") {
      markInOrderMutation.mutate({ id: expenseId, status: "in_order" });
      return;
    }
    if (action === "void") {
      setVoidTargetId(expenseId);
      setVoidDialogOpen(true);
      return;
    }
  };

  const handleApplyField = (expenseId: number, field: string, value: any) => {
    const fields: any = {};
    fields[field] = value;
    
    // Convert date strings to Date objects if needed
    if (field === "expenseDate" && typeof value === "string") {
      fields[field] = new Date(value);
    }
    
    applyFieldMutation.mutate({ id: expenseId, fields });
  };

  const handleApplyAll = (expenseId: number) => {
    const expense = needsReview.find((e) => e.id === expenseId);
    if (!expense || !expense.reviewMeta) return;

    const fields: any = {};
    const proposed = expense.reviewMeta.proposed;

    if (proposed.supplierName) fields.supplierName = proposed.supplierName.value;
    if (proposed.description) fields.description = proposed.description.value;
    if (proposed.expenseDate) {
      fields.expenseDate = typeof proposed.expenseDate.value === "string" 
        ? new Date(proposed.expenseDate.value) 
        : proposed.expenseDate.value;
    }
    if (proposed.grossAmountCents) fields.grossAmountCents = proposed.grossAmountCents.value;
    if (proposed.category) fields.category = proposed.category.value;
    if (proposed.vatMode) fields.vatMode = proposed.vatMode.value;
    if (proposed.businessUsePct) fields.businessUsePct = proposed.businessUsePct.value;

    applyAllMutation.mutate({ id: expenseId, fields });
  };

  const handleMarkInOrder = (expenseId: number) => {
    markInOrderMutation.mutate({ id: expenseId, status: "in_order" });
  };

  const handleExpandChange = (expenseId: number, expanded: boolean) => {
    setExpandedExpenseId(expanded ? expenseId : null);
  };

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Don't handle if dialog is open
      if (voidDialogOpen || deleteDialogOpen || bulkUploadOpen) {
        return;
      }

      // J / K → Focus next / previous needs_review card
      if (e.key === "j" || e.key === "J") {
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const currentIndex = focusedIndex ?? -1;
        const nextIndex = Math.min(currentIndex + 1, needsReview.length - 1);
        setFocusedIndex(nextIndex);
        const nextExpense = needsReview[nextIndex];
        if (nextExpense && cardRefs.current.has(nextExpense.id)) {
          cardRefs.current.get(nextExpense.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (e.key === "k" || e.key === "K") {
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const currentIndex = focusedIndex ?? needsReview.length;
        const prevIndex = Math.max(currentIndex - 1, 0);
        setFocusedIndex(prevIndex);
        const prevExpense = needsReview[prevIndex];
        if (prevExpense && cardRefs.current.has(prevExpense.id)) {
          cardRefs.current.get(prevExpense.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      // A → Apply all (focused card)
      if (e.key === "a" || e.key === "A") {
        if (e.ctrlKey || e.metaKey) return;
        if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < needsReview.length) {
          e.preventDefault();
          const expense = needsReview[focusedIndex];
          if (expense && expense.reviewMeta && Object.keys(expense.reviewMeta.proposed).length >= 2) {
            handleApplyAll(expense.id);
          }
        }
        return;
      }

      // I → Mark in order (focused card)
      if (e.key === "i" || e.key === "I") {
        if (e.ctrlKey || e.metaKey) return;
        if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < needsReview.length) {
          e.preventDefault();
          const expense = needsReview[focusedIndex];
          if (expense && (!expense.reviewMeta || expense.reviewMeta.missingRequired.length === 0)) {
            handleMarkInOrder(expense.id);
          }
        }
        return;
      }

      // Enter → Edit focused expense or first expense
      if (e.key === "Enter" && needsReview.length > 0) {
        e.preventDefault();
        const expenseId = focusedIndex !== null && focusedIndex >= 0 && focusedIndex < needsReview.length
          ? needsReview[focusedIndex].id
          : needsReview[0].id;
        navigate(`/expenses/${expenseId}`);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [needsReview, navigate, focusedIndex, voidDialogOpen, deleteDialogOpen, bulkUploadOpen, handleApplyAll, handleMarkInOrder]);

  const handleVoidConfirm = (reason: string) => {
    if (voidTargetId) {
      voidMutation.mutate({ id: voidTargetId, status: "void", voidReason: reason });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetId) {
      deleteMutation.mutate({ id: deleteTargetId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Expenses</h1>
          <p className="text-muted-foreground text-sm">Track and manage your business expenses</p>
        </div>
        <Link href="/expenses/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </Link>
      </div>

      {/* Header Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deductible Costs (Year)</CardTitle>
            <CardDescription>Total deductible expenses for {new Date().getFullYear()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(yearDeductible / 100, "EUR")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Quarter</CardTitle>
            <CardDescription>
              Q{Math.floor(new Date().getMonth() / 3) + 1} {new Date().getFullYear()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(quarterDeductible / 100, "EUR")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Needs Review Section */}
      <div className="space-y-4 pb-24 md:pb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Needs Review</h2>
          <Badge variant="outline">{needsReview.length}</Badge>
        </div>
        {needsReview.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No expenses need review</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {needsReview.map((expense, index) => {
              const isExpanded = expandedExpenseId === expense.id;
              const proposedCount = expense.reviewMeta
                ? Object.keys(expense.reviewMeta.proposed).length
                : 0;
              const canMarkInOrder = !expense.reviewMeta || expense.reviewMeta.missingRequired.length === 0;

              return (
                <div
                  key={expense.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(expense.id, el);
                  }}
                  className={focusedIndex === index ? "ring-2 ring-primary rounded-lg" : ""}
                >
                  <ReviewExpenseCard
                    expense={expense as any}
                    onApplyField={handleApplyField}
                    onApplyAll={handleApplyAll}
                    onMarkInOrder={handleMarkInOrder}
                    isExpanded={isExpanded}
                    onExpandChange={handleExpandChange}
                    isApplying={applyFieldMutation.isPending || applyAllMutation.isPending}
                    isMarkingInOrder={markInOrderMutation.isPending}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Sticky review actions (mobile only) */}
        {expandedExpenseId !== null && needsReview.length > 0 && (() => {
          const expense = needsReview.find((e) => e.id === expandedExpenseId);
          if (!expense || !expense.reviewMeta) return null;
          
          const proposedCount = Object.keys(expense.reviewMeta.proposed).length;
          const canMarkInOrder = expense.reviewMeta.missingRequired.length === 0;

          return (
            <StickyReviewActions
              proposedCount={proposedCount}
              canMarkInOrder={canMarkInOrder}
              onApplyAll={() => handleApplyAll(expense.id)}
              onMarkInOrder={() => handleMarkInOrder(expense.id)}
              isApplying={applyFieldMutation.isPending || applyAllMutation.isPending}
              isMarkingInOrder={markInOrderMutation.isPending}
            />
          );
        })()}
      </div>

      {/* In Order Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">In Order</h2>
          <Badge variant="default">{inOrder.length}</Badge>
        </div>
        {inOrder.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No expenses in order yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inOrder.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onAction={handleAction}
                showVoid={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Void Dialog */}
      <VoidExpenseDialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
          if (!open) {
            setVoidTargetId(null);
          }
        }}
        onConfirm={handleVoidConfirm}
        isVoiding={voidMutation.isPending}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) {
            setDeleteTargetId(null);
          }
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        isDeleting={deleteMutation.isPending}
      />

      {/* Capture FAB */}
      <CaptureFab
        onBulkUpload={() => setBulkUploadOpen(true)}
        onManual={() => navigate("/expenses/new")}
      />

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUpload={handleBulkUpload}
        isUploading={bulkUploadMutation.isPending}
      />
    </div>
  );
}

