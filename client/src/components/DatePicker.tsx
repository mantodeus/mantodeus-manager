import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface DatePickerProps {
  selectedDates: Date[];
  onChange: (dates: Date[]) => void;
  className?: string;
}

export function DatePicker({ selectedDates, onChange, className }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Get user preferences for week start
  const { data: preferences } = trpc.settings.preferences.get.useQuery();
  const weekStartsOn = preferences?.weekStartsOn || "monday";

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = new Date(year, month, 1).getDay();
    // Adjust for week start preference
    if (weekStartsOn === "monday") {
      // Convert: 0 (Sun) -> 6, 1 (Mon) -> 0, 2 (Tue) -> 1, etc.
      return day === 0 ? 6 : day - 1;
    }
    // Sunday start: return as-is (0 = Sunday, 1 = Monday, etc.)
    return day;
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some((selected) => isSameDay(selected, date));
  };

  const toggleDate = (date: Date) => {
    const isSelected = isDateSelected(date);
    if (isSelected) {
      onChange(selectedDates.filter((d) => !isSameDay(d, date)));
    } else {
      onChange([...selectedDates, date]);
    }
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const clearAllDates = () => {
    onChange([]);
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const days = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="h-10" />);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const selected = isDateSelected(date);
    const isToday = isSameDay(date, new Date());

    days.push(
      <button
        key={day}
        type="button"
        onClick={() => toggleDate(date)}
        className={cn(
          "h-10 w-full rounded-md text-sm font-medium transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          selected && "bg-primary text-primary-foreground hover:bg-primary/90 font-bold ring-2 ring-primary ring-offset-2",
          isToday && !selected && "border-2 border-primary",
          !selected && "text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        {day}
      </button>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="icon" onClick={previousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold">{monthName}</div>
        <Button type="button" variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {(weekStartsOn === "monday" 
          ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        ).map((day) => (
          <div key={day} className="h-10 flex items-center justify-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {days}
      </div>

      {selectedDates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Selected Dates ({selectedDates.length})
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAllDates}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {selectedDates
              .sort((a, b) => a.getTime() - b.getTime())
              .map((date, index) => (
                <div
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                >
                  {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  <button
                    type="button"
                    onClick={() => toggleDate(date)}
                    className="hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
