/**
 * CaptureFab Component
 * 
 * Floating Action Button for quick expense capture
 * - Scan receipt (camera)
 * - Upload receipt(s) (bulk)
 * - Manual expense (existing)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, Upload, Plus, X } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface CaptureFabProps {
  onScan?: () => void;
  onBulkUpload?: () => void;
  onManual?: () => void;
  className?: string;
}

export function CaptureFab({
  onScan,
  onBulkUpload,
  onManual,
  className,
}: CaptureFabProps) {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  // Only show on /expenses page
  if (location !== "/expenses") {
    return null;
  }

  const handleScan = () => {
    setOpen(false);
    if (onScan) {
      onScan();
    } else {
      navigate("/expenses/scan");
    }
  };

  const handleBulkUpload = () => {
    setOpen(false);
    if (onBulkUpload) {
      onBulkUpload();
    }
  };

  const handleManual = () => {
    setOpen(false);
    if (onManual) {
      onManual();
    } else {
      navigate("/expenses/new");
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2",
        className
      )}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          >
            {open ? (
              <X className="h-6 w-6" />
            ) : (
              <Plus className="h-6 w-6" />
            )}
            <span className="sr-only">Capture expense</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="mb-2 min-w-[200px]"
          side="top"
        >
          <DropdownMenuItem onClick={handleScan} className="cursor-pointer">
            <Camera className="h-4 w-4 mr-2" />
            <span>Scan receipt</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleBulkUpload} className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            <span>Upload receipt(s)</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleManual} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            <span>Manual expense</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

