/**
 * Review Expense Card Component (Mobile-First)
 * 
 * Card display for expenses in "needs_review" status with:
 * - Review score badge
 * - Autofill chips for proposed fields
 * - Missing fields hint
 * - Support for sticky actions
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, FileText, CheckCircle2, AlertCircle, XCircle, Trash2 } from "@/components/ui/Icon";
import { useLocation } from "wouter";
import { getCategoryLabel } from "./CategorySelect";
import { formatCurrency } from "@/lib/currencyFormat";
import { getConfidenceLabel, getReviewScoreLabel, type ProposedFields } from "@/lib/expenseConfidence";

type ReviewMeta = {
  overallScore: number;
  missingRequired: string[];
  proposed: ProposedFields;
};

interface ReviewExpenseCardProps {
  expense: {
    id: number;
    supplierName: string;
    description: string | null;
    category: string | null;
    grossAmountCents: number;
    currency: string;
    businessUsePct: number;
    status: "needs_review" | "in_order" | "void";
    receiptCount: number;
    reviewMeta: ReviewMeta | null;
  };
  onApplyField?: (expenseId: number, field: string, value: any) => void;
  onApplyAll?: (expenseId: number) => void;
  onMarkInOrder?: (expenseId: number) => void;
  onDelete?: (expenseId: number) => void;
  isExpanded?: boolean;
  onExpandChange?: (expenseId: number, expanded: boolean) => void;
  isApplying?: boolean;
  isMarkingInOrder?: boolean;
  isDeleting?: boolean;
}

export function ReviewExpenseCard({
  expense,
  onApplyField,
  onApplyAll,
  onMarkInOrder,
  onDelete,
  isExpanded = false,
  onExpandChange,
  isApplying = false,
  isMarkingInOrder = false,
  isDeleting = false,
}: ReviewExpenseCardProps) {
  const [, navigate] = useLocation();
  const reviewMeta = expense.reviewMeta;
  const proposedCount = reviewMeta
    ? Object.keys(reviewMeta.proposed).length
    : 0;

  const handleCardClick = () => {
    navigate(`/expenses/${expense.id}`);
  };

  const getScoreBadge = () => {
    if (!reviewMeta) return null;

    const score = reviewMeta.overallScore;
    const label = getReviewScoreLabel(score);

    if (score >= 85) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    } else if (score >= 60) {
      return (
        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs border-red-500 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    }
  };

  const handleChipClick = (field: string, value: any) => {
    if (onApplyField) {
      onApplyField(expense.id, field, value);
    }
  };

  const handleExpand = () => {
    if (onExpandChange) {
      onExpandChange(expense.id, !isExpanded);
    }
  };

  return (
    <Card 
      className="hover:shadow-lg transition-all h-full cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader>
        {/* Top row: Supplier, Amount, Score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1">
              {expense.supplierName || "Untitled Expense"}
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              {formatCurrency(expense.grossAmountCents / 100, expense.currency) || "—"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {getScoreBadge()}
            {onExpandChange && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand();
                }}
                className="h-8 w-8 p-0"
              >
                {isExpanded ? "−" : "+"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Receipt count */}
        <div className="flex items-center gap-2">
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
          {expense.category && (
            <Badge variant="secondary" className="text-xs">
              {getCategoryLabel(expense.category as any)}
            </Badge>
          )}
        </div>

        {/* Autofill chips section (stacked on mobile) */}
        {isExpanded && reviewMeta && proposedCount > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Proposed changes:
            </div>
            <div className="flex flex-wrap gap-2">
              {reviewMeta.proposed.supplierName && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("supplierName", reviewMeta.proposed.supplierName!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Supplier</span>
                    <span className="text-xs text-muted-foreground">
                      {reviewMeta.proposed.supplierName.value} ({getConfidenceLabel(reviewMeta.proposed.supplierName.confidence)})
                    </span>
                  </div>
                </Button>
              )}

              {reviewMeta.proposed.description && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("description", reviewMeta.proposed.description!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Description</span>
                    <span className="text-xs text-muted-foreground">
                      {getConfidenceLabel(reviewMeta.proposed.description.confidence)}
                    </span>
                  </div>
                </Button>
              )}

              {reviewMeta.proposed.grossAmountCents && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("grossAmountCents", reviewMeta.proposed.grossAmountCents!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Amount</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(reviewMeta.proposed.grossAmountCents.value / 100, expense.currency)} ({getConfidenceLabel(reviewMeta.proposed.grossAmountCents.confidence)})
                    </span>
                  </div>
                </Button>
              )}

              {reviewMeta.proposed.category && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("category", reviewMeta.proposed.category!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Category</span>
                    <span className="text-xs text-muted-foreground">
                      {getCategoryLabel(reviewMeta.proposed.category.value as any)} ({getConfidenceLabel(reviewMeta.proposed.category.confidence)})
                    </span>
                  </div>
                </Button>
              )}

              {reviewMeta.proposed.vatMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("vatMode", reviewMeta.proposed.vatMode!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">VAT</span>
                    <span className="text-xs text-muted-foreground">
                      {reviewMeta.proposed.vatMode.value} ({getConfidenceLabel(reviewMeta.proposed.vatMode.confidence)})
                    </span>
                  </div>
                </Button>
              )}

              {reviewMeta.proposed.businessUsePct && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 min-h-[44px] text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChipClick("businessUsePct", reviewMeta.proposed.businessUsePct!.value);
                  }}
                  disabled={isApplying}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Business Use</span>
                    <span className="text-xs text-muted-foreground">
                      {reviewMeta.proposed.businessUsePct.value}% ({getConfidenceLabel(reviewMeta.proposed.businessUsePct.confidence)})
                    </span>
                  </div>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Missing fields hint */}
        {reviewMeta && reviewMeta.missingRequired.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Missing: {reviewMeta.missingRequired.join(", ")}
          </div>
        )}

        {/* Desktop: Inline actions (hidden on mobile) */}
        <div className="hidden md:flex items-center gap-2 pt-2 border-t">
          {proposedCount >= 2 && onApplyAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApplyAll(expense.id);
              }}
              disabled={isApplying}
            >
              Apply all
            </Button>
          )}
          {onMarkInOrder && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkInOrder(expense.id);
              }}
              disabled={isMarkingInOrder || reviewMeta?.missingRequired.length !== 0}
            >
              Mark in order
            </Button>
          )}
          {onDelete && expense.status === "needs_review" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(expense.id);
              }}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

