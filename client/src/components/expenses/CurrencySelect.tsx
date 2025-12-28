/**
 * CurrencySelect Component
 * 
 * Dropdown select for currency codes
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CURRENCIES = [
  { code: "EUR", name: "Euro (€)" },
  { code: "USD", name: "US Dollar ($)" },
  { code: "GBP", name: "British Pound (£)" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "PLN", name: "Polish Złoty" },
  { code: "CZK", name: "Czech Koruna" },
];

interface CurrencySelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function CurrencySelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select currency",
}: CurrencySelectProps) {
  return (
    <Select
      value={value || "EUR"}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((currency) => (
          <SelectItem key={currency.code} value={currency.code}>
            {currency.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

