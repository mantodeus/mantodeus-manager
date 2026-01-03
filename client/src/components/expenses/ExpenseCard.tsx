/**
 * ExpenseCard Component
 * 
 * Card display for an expense in the list view
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemActionsMenu, ItemAction } from "@/components/ItemActionsMenu";
import { Receipt, FileText } from "@/components/ui/Icon";
import { Link } from "wouter";
import { getCategoryLabel } from "./CategorySelect";
import { formatCurrency } from "@/lib/currencyFormat";

interface ExpenseCardProps {
  expense: {
    id: number;
    description: string | null;
    category: string | null;
    grossAmountCents: number;
    currency: string;
    businessUsePct: number;
    status: "needs_review" | "in_order" | "void";
    paymentStatus: "paid" | "unpaid";
    paymentDate: Date | null;
    receiptCount: number;
  };
  onAction: (action: ItemAction, expenseId: number) => void;
  showVoid?: boolean;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export function ExpenseCard({ expense, onAction, showVoid = false, isMultiSelectMode = false, isSelected = false, onToggleSelection }: ExpenseCardProps) {
  const deductibleCents = Math.round(
    (expense.grossAmountCents * expense.businessUsePct) / 100
  );

  const statusBadge = () => {
    switch (expense.status) {
      case "needs_review":
        return <Badge variant="outline" className="text-xs">Needs Review</Badge>;
      case "in_order":
        return <Badge variant="default" className="text-xs">In Order</Badge>;
      case "void":
        return <Badge variant="secondary" className="text-xs">Void</Badge>;
      default:
        return null;
    }
  };

  const getActions = (): ItemAction[] => {
    const actions: ItemAction[] = ["edit", "select"];
    if (expense.status === "needs_review") {
      actions.push("markAsInOrder");
    }
    if (expense.status === "in_order" && showVoid) {
      actions.push("void");
    }
    return actions;
  };

  const handleAction = (action: ItemAction) => {
    onAction(action, expense.id);
  };

  const handleCardClick = () => {
    if (isMultiSelectMode && onToggleSelection) {
      onToggleSelection();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`${isMultiSelectMode ? "cursor-pointer" : ""} ${isSelected ? "item-selected rounded-lg" : ""}`}
    >
      <Link href={isMultiSelectMode ? "#" : `/expenses/${expense.id}`} onClick={(e) => isMultiSelectMode && e.preventDefault()}>
        <Card className="hover:shadow-lg transition-all h-full">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg line-clamp-2">
                    {expense.description || "Untitled Expense"}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {getCategoryLabel(expense.category as any)}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                {statusBadge()}
                {!isMultiSelectMode && (
                  <ItemActionsMenu
                    onAction={handleAction}
                    actions={getActions()}
                    triggerClassName="text-muted-foreground hover:text-foreground"
                  />
                )}
              </div>
            </div>
          </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gross Amount</span>
            <span className="text-sm font-medium">
              {formatCurrency(expense.grossAmountCents / 100, expense.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Deductible</span>
            <span className="text-sm font-medium">
              {formatCurrency(deductibleCents / 100, expense.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Business Use</span>
            <span className="text-sm font-medium">{expense.businessUsePct}%</span>
          </div>
          {expense.paymentStatus === "paid" && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment</span>
              <Badge variant="secondary" className="text-xs">Paid</Badge>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2 border-t">
            {expense.receiptCount === 0 ? (
              <Badge variant="outline" className="text-xs text-destructive">
                <FileText className="h-3 w-3 mr-1" />
                No document
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <Receipt className="h-3 w-3 mr-1" />
                {expense.receiptCount} receipt{expense.receiptCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
      </Link>
    </div>
  );
}

