/**
 * SuggestionBadge Component
 * 
 * Displays a suggestion badge with confidence indicator and tooltip
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

interface SuggestionBadgeProps {
  confidence: number;
  reason?: string | null;
  className?: string;
}

export function SuggestionBadge({
  confidence,
  reason,
  className,
}: SuggestionBadgeProps) {
  const level: ConfidenceLevel =
    confidence >= 0.8 ? "high" : confidence >= 0.6 ? "medium" : "low";

  const levelConfig = {
    high: {
      label: "High",
      variant: "default" as const,
      color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    },
    medium: {
      label: "Medium",
      variant: "secondary" as const,
      color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    },
    low: {
      label: "Low",
      variant: "outline" as const,
      color: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
    },
  };

  const config = levelConfig[level];

  const badge = (
    <Badge
      variant={config.variant}
      className={cn(
        "text-xs border",
        config.color,
        className
      )}
    >
      <span>Suggested</span>
      <span className="ml-1 opacity-70">({config.label})</span>
    </Badge>
  );

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-1">
            {badge}
            <Info className="h-3 w-3 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}

