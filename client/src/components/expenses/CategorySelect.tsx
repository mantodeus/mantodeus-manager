/**
 * CategorySelect Component
 * 
 * Dropdown select for expense categories with human-readable labels
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ExpenseCategory =
  | "office_supplies"
  | "travel"
  | "meals"
  | "equipment"
  | "software"
  | "professional_services"
  | "utilities"
  | "rent"
  | "insurance"
  | "training"
  | "other";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  office_supplies: "Office Supplies",
  travel: "Travel",
  meals: "Food & Drinks",
  equipment: "Equipment",
  software: "Software",
  professional_services: "Professional Services",
  utilities: "Utilities",
  rent: "Rent",
  insurance: "Insurance",
  training: "Training",
  other: "Other",
};

interface CategorySelectProps {
  value?: ExpenseCategory | null;
  onValueChange: (value: ExpenseCategory) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CategorySelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select category",
}: CategorySelectProps) {
  return (
    <Select
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getCategoryLabel(category: ExpenseCategory | null | undefined): string {
  if (!category) return "Uncategorized";
  return CATEGORY_LABELS[category] || category;
}

