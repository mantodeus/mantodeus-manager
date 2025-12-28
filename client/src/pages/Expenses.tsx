/**
 * Expenses List Page
 * 
 * Displays all expenses with:
 * - Header cards showing deductible costs (year and current quarter)
 * - Sections: "Needs Review" and "In Order"
 * - Excludes void expenses by default
 * - Card actions: Edit, Mark as In Order, Void
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Plus, Loader2, Receipt } from "lucide-react";
import { Link } from "wouter";
import { ExpenseCard } from "@/components/expenses/ExpenseCard";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencyFormat";
import { VoidExpenseDialog } from "@/components/expenses/VoidExpenseDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

type ExpenseListItem = RouterOutputs["expenses"]["list"][number];

export default function Expenses() {
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [showVoid, setShowVoid] = useState(false);

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

  // Filter expenses by status
  const needsReview = expenses.filter((e) => e.status === "needs_review");
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

  const handleAction = (action: ItemAction, expenseId: number) => {
    if (action === "edit") {
      // Navigation handled by ExpenseCard Link
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
    </div>
  );
}

