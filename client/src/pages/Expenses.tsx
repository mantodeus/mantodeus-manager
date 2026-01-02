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
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, Loader2, Receipt } from "lucide-react";
import { Link, useLocation } from "wouter";
import { ExpenseCard } from "@/components/expenses/ExpenseCard";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencyFormat";
import { VoidExpenseDialog } from "@/components/expenses/VoidExpenseDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { CaptureFab } from "@/components/expenses/CaptureFab";
import { BulkUploadDialog } from "@/components/expenses/BulkUploadDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectBar, createDeleteAction } from "@/components/MultiSelectBar";
import { CheckCircle2 } from "lucide-react";

type ExpenseListItem = RouterOutputs["expenses"]["list"][number];

export default function Expenses() {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [showVoid, setShowVoid] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [, navigate] = useLocation();

  const { data: expenses = [], isLoading, refetch } = trpc.expenses.list.useQuery({
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

      const expenseDate = new Date(expense.incurredAt);
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

  const markInOrderMutation = trpc.expenses.markInOrder.useMutation({
    onSuccess: () => {
      toast.success("Expense marked as in order");
      utils.expenses.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to mark expense as in order");
    },
  });

  const voidMutation = trpc.expenses.void.useMutation({
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

  const deleteMutation = trpc.expenses.delete.useMutation({
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

  const bulkUploadMutation = trpc.expenses.uploadReceiptsBulk.useMutation({
    onSuccess: async (data) => {
      toast.success("Receipts uploaded successfully");
      setBulkUploadOpen(false);
      // Force refetch to ensure UI updates immediately
      await utils.expenses.list.invalidate();
      // If expenses were created, invalidate their individual queries
      if (data && typeof data === "object" && "expenseIds" in data && Array.isArray(data.expenseIds)) {
        await Promise.all(
          (data.expenseIds as number[]).map((id) =>
            utils.expenses.getById.invalidate({ id })
          )
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
    if (action === "select") {
      setIsMultiSelectMode(true);
      setSelectedIds(new Set([expenseId]));
      return;
    }
    if (action === "markAsInOrder") {
      markInOrderMutation.mutate({ id: expenseId });
      return;
    }
    if (action === "void") {
      setVoidTargetId(expenseId);
      setVoidDialogOpen(true);
      return;
    }
  };

  const toggleSelection = (expenseId: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(expenseId)) {
      newSelected.delete(expenseId);
    } else {
      newSelected.add(expenseId);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchMarkInOrder = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      markInOrderMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    ids.forEach((id) => {
      deleteMutation.mutate({ id });
    });
    setSelectedIds(new Set());
    setIsMultiSelectMode(false);
  };

  // Keyboard navigation
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

      // Enter → Edit first expense in Needs Review
      if (e.key === "Enter" && needsReview.length > 0) {
        e.preventDefault();
        navigate(`/expenses/${needsReview[0].id}`);
        return;
      }

      // I → Mark as In Order (first expense in Needs Review)
      if (e.key === "i" || e.key === "I") {
        if (e.ctrlKey || e.metaKey) return; // Don't interfere with Cmd/Ctrl+I
        if (needsReview.length > 0) {
          e.preventDefault();
          markInOrderMutation.mutate({ id: needsReview[0].id });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [needsReview, navigate, markInOrderMutation]);

  const handleVoidConfirm = (reason: string) => {
    if (voidTargetId) {
      voidMutation.mutate({ id: voidTargetId, reason });
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
      <div className="space-y-4">
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
            {needsReview.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                onAction={handleAction}
                showVoid={false}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedIds.has(expense.id)}
                onToggleSelection={() => toggleSelection(expense.id)}
              />
            ))}
          </div>
        )}
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
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedIds.has(expense.id)}
                onToggleSelection={() => toggleSelection(expense.id)}
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

      {/* Multi-select bar */}
      {isMultiSelectMode && (
        <MultiSelectBar
          selectedCount={selectedIds.size}
          onCancel={() => {
            setIsMultiSelectMode(false);
            setSelectedIds(new Set());
          }}
          actions={[
            {
              label: "Mark as In Order",
              icon: CheckCircle2,
              onClick: handleBatchMarkInOrder,
              variant: "default",
              disabled: markInOrderMutation.isPending,
            },
            createDeleteAction(handleBatchDelete, deleteMutation.isPending),
          ]}
        />
      )}
    </div>
  );
}

