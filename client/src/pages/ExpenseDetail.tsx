/**
 * Expense Detail Page
 * 
 * Editable form for viewing/editing a single expense
 * - Full expense form
 * - Receipt upload and management
 * - Actions: Save, Mark as In Order, Void, Delete
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useRoute, useLocation } from "wouter";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { VoidExpenseDialog } from "@/components/expenses/VoidExpenseDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";
import type { ExpenseCategory } from "@/components/expenses/CategorySelect";

export default function ExpenseDetail() {
  const [, params] = useRoute("/expenses/:id");
  const [, navigate] = useLocation();
  const expenseId = params?.id ? parseInt(params.id) : null;
  const isNew = params?.id === "new";

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: expense, isLoading, refetch } = trpc.expenses.getExpense.useQuery(
    { id: expenseId! },
    { enabled: !isNew && !!expenseId }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.expenses.createManualExpense.useMutation({
    onSuccess: (data) => {
      toast.success("Expense created successfully");
      navigate(`/expenses/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create expense");
    },
  });

  const updateMutation = trpc.expenses.updateExpense.useMutation({
    onSuccess: (_, variables) => {
      toast.success("Expense updated successfully");
      utils.expenses.getExpense.invalidate({ id: expenseId! });
      utils.expenses.list.invalidate();
      
      // If description changed, refetch to get new suggestions
      if (variables.description !== undefined && variables.description !== expense?.description) {
        // Small delay to ensure backend has processed
        setTimeout(() => {
          refetch();
        }, 500);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update expense");
    },
  });

  const markInOrderMutation = trpc.expenses.setExpenseStatus.useMutation({
    onSuccess: async () => {
      toast.success("Expense marked as in order");
      utils.expenses.getExpense.invalidate({ id: expenseId! });
      
      // Get list of expenses to find next Needs Review item
      const expensesList = await utils.expenses.list.fetch({ includeVoid: false });
      const needsReview = expensesList
        .filter((e) => e.status === "needs_review")
        .sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA; // DESC
        });

      // Find next expense (skip current one)
      const currentIndex = needsReview.findIndex((e) => e.id === expenseId);
      const nextExpense = needsReview[currentIndex + 1];

      if (nextExpense) {
        navigate(`/expenses/${nextExpense.id}`);
      } else {
        navigate("/expenses");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Failed to mark expense as in order");
    },
  });

  const voidMutation = trpc.expenses.setExpenseStatus.useMutation({
    onSuccess: () => {
      toast.success("Expense voided");
      setVoidDialogOpen(false);
      utils.expenses.getExpense.invalidate({ id: expenseId! });
      utils.expenses.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to void expense");
    },
  });

  const deleteMutation = trpc.expenses.deleteExpense.useMutation({
    onSuccess: () => {
      toast.success("Expense deleted");
      navigate("/expenses");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete expense");
    },
  });

  const uploadReceiptMutation = trpc.expenses.uploadExpenseReceipt.useMutation();
  const registerReceiptMutation = trpc.expenses.registerReceipt.useMutation();

  const deleteReceiptMutation = trpc.expenses.deleteExpenseFile.useMutation({
    onSuccess: () => {
      toast.success("Receipt deleted successfully");
      utils.expenses.getExpense.invalidate({ id: expenseId! });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete receipt");
    },
  });

  const acceptSuggestionMutation = trpc.expenses.updateExpense.useMutation({
    onSuccess: () => {
      toast.success("Suggestion applied");
      utils.expenses.getExpense.invalidate({ id: expenseId! });
      utils.expenses.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply suggestion");
    },
  });

  const handleAcceptSuggestion = (field: string, value: string | number) => {
    if (!expenseId) return;

    const update: Record<string, string | number> = {};
    update[field] = value;

    acceptSuggestionMutation.mutate({
      id: expenseId,
      ...update,
    });
  };

  const handleSave = (formData: {
    description: string | null;
    category: ExpenseCategory | null;
    grossAmountCents: number;
    currency: string;
    businessUsePct: number;
    paid: boolean;
    paidAt: Date | null;
    notes: string | null;
  }) => {
    if (isNew) {
      if (!formData.category) {
        toast.error("Please select a category before saving");
        return;
      }

      const supplierName =
        formData.description?.trim() || "Expense";

      createMutation.mutate({
        supplierName,
        description: formData.description,
        expenseDate: new Date(),
        grossAmountCents: formData.grossAmountCents,
        currency: formData.currency,
        vatMode: "none",
        vatRate: null,
        vatAmountCents: null,
        businessUsePct: formData.businessUsePct,
        category: formData.category,
        paymentStatus: formData.paid ? "paid" : "unpaid",
        paymentDate: formData.paid ? formData.paidAt || new Date() : null,
        paymentMethod: null,
      });
    } else if (expenseId) {
      updateMutation.mutate({
        id: expenseId,
        description: formData.description,
        category: formData.category || undefined,
        grossAmountCents: formData.grossAmountCents,
        currency: formData.currency,
        businessUsePct: formData.businessUsePct,
        paymentStatus: formData.paid ? "paid" : "unpaid",
        paymentDate: formData.paid ? formData.paidAt || new Date() : null,
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Enter → Save
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        // Don't trigger if typing in input/textarea
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }
        e.preventDefault();
        // Trigger save - find the save button
        const saveButton = Array.from(document.querySelectorAll("button")).find(
          (btn) => btn.textContent?.includes("Save") && !btn.disabled
        ) as HTMLButtonElement | undefined;
        if (saveButton) {
          saveButton.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleMarkInOrder = () => {
    if (expenseId) {
      markInOrderMutation.mutate({ id: expenseId, status: "in_order" });
    }
  };

  const handleVoid = () => {
    setVoidDialogOpen(true);
  };

  const handleVoidConfirm = (reason: string) => {
    if (expenseId) {
      voidMutation.mutate({ id: expenseId, status: "void", voidReason: reason });
    }
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (expenseId) {
      deleteMutation.mutate({ id: expenseId });
    }
  };

  const handleReceiptUpload = async (files: File[]) => {
    if (isNew || !expenseId || files.length === 0) {
      toast.error("Please save the expense first before uploading receipts");
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    // Upload files sequentially to avoid race conditions
    for (const file of files) {
      try {
        const { uploadUrl, s3Key } = await uploadReceiptMutation.mutateAsync({
          expenseId,
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        });

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Storage upload failed (${uploadResponse.status})`);
        }

        await registerReceiptMutation.mutateAsync({
          expenseId,
          s3Key,
          mimeType: file.type,
          originalFilename: file.name,
          fileSize: file.size,
        });

        successCount += 1;
      } catch (error) {
        console.error("Failed to upload receipt:", file.name, error);
        failureCount += 1;
      }
    }

    if (successCount > 0 && failureCount === 0) {
      toast.success("Receipt uploaded successfully");
    } else if (failureCount > 0) {
      toast.error(
        `Uploaded ${successCount} receipt${successCount === 1 ? "" : "s"} with ${failureCount} failure${failureCount === 1 ? "" : "s"}`
      );
    }

    if (successCount > 0) {
      await utils.expenses.getExpense.invalidate({ id: expenseId });
      await refetch();
      await utils.expenses.list.invalidate();
    }
  };

  const handleReceiptDelete = (receiptId: number) => {
    deleteReceiptMutation.mutate({ id: receiptId });
  };

  const handleReceiptView = async (receiptId: number) => {
    try {
      const result = await utils.expenses.getReceiptUrl.fetch({ fileId: receiptId });
      window.open(result.url, "_blank");
    } catch (error) {
      toast.error("Failed to open receipt");
    }
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canMarkInOrder = expense?.status === "needs_review";
  const canVoid = expense?.status === "in_order";
  const canDelete = expense?.status === "needs_review";

  // Don't show suggestions for voided expenses
  const suggestions = expense?.status !== "void" ? expense?.suggestions || [] : [];

  const files = expense?.files?.map((file) => ({
    id: file.id,
    filename: file.originalFilename,
    fileKey: file.s3Key,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    uploadedAt: new Date(file.createdAt),
    previewUrl: file.previewUrl || null,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/expenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-regular">
            {isNew ? "New Expense" : expense?.description || "Expense"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isNew ? "Create a new expense" : "View and edit expense details"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? "Expense Details" : "Edit Expense"}</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm
            initialData={
              expense
                ? {
                    description: expense.description,
                    category: expense.category as ExpenseCategory | null,
                    grossAmountCents: expense.grossAmountCents,
                    currency: expense.currency,
                    businessUsePct: expense.businessUsePct,
                    paid: expense.paymentStatus === "paid",
                    paidAt: expense.paymentDate ? new Date(expense.paymentDate) : null,
                    notes: null,
                  }
                : undefined
            }
            suggestions={suggestions}
            files={files}
            onSave={handleSave}
            onAcceptSuggestion={handleAcceptSuggestion}
            onMarkInOrder={canMarkInOrder ? handleMarkInOrder : undefined}
            onVoid={canVoid ? handleVoid : undefined}
            onDelete={canDelete ? handleDelete : undefined}
            onReceiptUpload={!isNew ? handleReceiptUpload : undefined}
            onReceiptDelete={!isNew ? handleReceiptDelete : undefined}
            onReceiptView={!isNew ? handleReceiptView : undefined}
            isSaving={createMutation.isPending || updateMutation.isPending}
            isAcceptingSuggestion={acceptSuggestionMutation.isPending}
            isMarkingInOrder={markInOrderMutation.isPending}
            isVoiding={voidMutation.isPending}
            isDeleting={deleteMutation.isPending}
            isUploadingReceipt={
              uploadReceiptMutation.isPending || registerReceiptMutation.isPending
            }
            canMarkInOrder={canMarkInOrder}
            canVoid={canVoid}
            canDelete={canDelete}
            showActions={true}
          />
        </CardContent>
      </Card>

      {/* Void Dialog */}
      <VoidExpenseDialog
        open={voidDialogOpen}
        onOpenChange={(open) => {
          setVoidDialogOpen(open);
        }}
        onConfirm={handleVoidConfirm}
        isVoiding={voidMutation.isPending}
      />

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
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

