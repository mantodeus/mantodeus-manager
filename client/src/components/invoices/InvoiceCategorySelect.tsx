/**
 * InvoiceCategorySelect Component
 * 
 * Dropdown select for invoice income categories with bilingual (EN/DE) support.
 * Designed for construction industry (rope access, stone, façade, construction).
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type InvoiceIncomeCategory =
  | "services"
  | "materials_goods"
  | "equipment_plant"
  | "subcontracting_commissions"
  | "other_income";

const CATEGORY_LABELS_EN: Record<InvoiceIncomeCategory, string> = {
  services: "Services",
  materials_goods: "Materials & goods",
  equipment_plant: "Equipment & plant",
  subcontracting_commissions: "Subcontracting & commissions",
  other_income: "Other income",
};

const CATEGORY_LABELS_DE: Record<InvoiceIncomeCategory, string> = {
  services: "Dienstleistungen",
  materials_goods: "Materialien & Waren",
  equipment_plant: "Geräte & Maschinen",
  subcontracting_commissions: "Nachunternehmer & Provisionen",
  other_income: "Sonstige Einnahmen",
};

interface InvoiceCategorySelectProps {
  value?: InvoiceIncomeCategory | string | null;
  onValueChange: (value: InvoiceIncomeCategory) => void;
  language: "en" | "de";
  disabled?: boolean;
  placeholder?: string;
}

export function InvoiceCategorySelect({
  value,
  onValueChange,
  language,
  disabled = false,
  placeholder = "Select category",
}: InvoiceCategorySelectProps) {
  // Normalize value - if it's null/undefined or not a valid category, default to "services"
  const normalizedValue: InvoiceIncomeCategory = 
    value && typeof value === "string" && Object.keys(CATEGORY_LABELS_EN).includes(value)
      ? (value as InvoiceIncomeCategory)
      : "services";

  const labels = language === "de" ? CATEGORY_LABELS_DE : CATEGORY_LABELS_EN;

  return (
    <Select
      value={normalizedValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[150]">
        {Object.entries(labels).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Get the label for an invoice category in the specified language
 */
export function getInvoiceCategoryLabel(
  category: InvoiceIncomeCategory | string | null | undefined,
  language: "en" | "de" = "en"
): string {
  if (!category) return language === "de" ? "Dienstleistungen" : "Services";
  
  const labels = language === "de" ? CATEGORY_LABELS_DE : CATEGORY_LABELS_EN;
  
  // If it's a valid category key, return the label
  if (Object.keys(CATEGORY_LABELS_EN).includes(category)) {
    return labels[category as InvoiceIncomeCategory];
  }
  
  // Otherwise return the category as-is (for backwards compatibility with free-text)
  return category;
}
