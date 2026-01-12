import { useAuth } from "@/_core/hooks/useAuth";
import { DataExportImportDialog } from "./DataExportImportDialog";
import { AssistantPanel } from "./assistant/AssistantPanel";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppLoadingScreen } from './AppLoadingScreen';
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  MobileNavProvider,
  BottomTabBar,
  ModuleScroller,
  ScrollerOverlay,
  useRouteTracking,
} from "./mobile-nav";
import {
  DesktopNavProvider,
  DesktopBottomTabBar,
} from "./desktop-nav";
import { useIsMobile } from "@/hooks/useMobile";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const { loading, user } = useAuth();

  // Show loading screen during auth check or if not authenticated
  // Routing is handled by App.tsx, so we just show loading here
  if (loading || !user) {
    return <AppLoadingScreen />
  }

  if (isMobile) {
    return (
      <MobileNavProvider>
        <MobileDashboardLayoutContent>
          {children}
        </MobileDashboardLayoutContent>
      </MobileNavProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <DesktopNavProvider>
        <DesktopDashboardLayoutContent>
          {children}
        </DesktopDashboardLayoutContent>
      </DesktopNavProvider>
    </TooltipProvider>
  );
}

/**
 * Desktop Layout with Bottom Tab Bar navigation only
 */
function DesktopDashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dataDialogOpen, setDataDialogOpen] = useState(false);

  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Content + Assistant in flex row */}
      <div className="flex flex-1 min-h-0 w-full">
        {/* Main Content Area - shrinks when assistant is open */}
        <main 
          className="app-content flex-1 min-w-0 min-h-0 overflow-y-auto p-4 bg-background"
        >
          {children}
        </main>

        {/* Manto Assistant Panel - dock on desktop, not overlay */}
        <MantoAssistantWrapper />
      </div>

      {/* Data Export/Import Dialog */}
      <DataExportImportDialog
        open={dataDialogOpen}
        onOpenChange={setDataDialogOpen}
      />

      {/* Desktop Bottom Tab Bar - only navigation mechanism */}
      <DesktopBottomTabBar />
    </div>
  );
}

/**
 * Mobile Layout with Bottom Tab Bar + Module Scroller
 */
function MobileDashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  // Track route changes to update active tab and last used module
  useRouteTracking();

  return (
    <div className="flex min-h-svh w-full flex-col">
      <div className="h-0" />

      <main className="app-content flex-1 min-w-0 min-h-0 overflow-y-auto p-4 bg-background">
        {children}
      </main>

      {/* Mobile Navigation */}
      <ScrollerOverlay />
      <ModuleScroller />
      <BottomTabBar />
      
      {/* Manto Assistant Panel - bottom sheet on mobile */}
      <MantoAssistantWrapper />
    </div>
  );
}

/**
 * Helper component to provide page context to AssistantPanel
 */
function MantoAssistantWrapper() {
  const [location] = useLocation();
  
  // Invoice detail page: /invoices/:id
  const invoiceMatch = location.match(/^\/invoices\/(\d+)(?:\?|#|$)/);
  if (invoiceMatch) {
    return (
      <AssistantPanel
        scope="invoice_detail"
        scopeId={parseInt(invoiceMatch[1], 10)}
        pageName="Invoice"
      />
    );
  }
  
  // Default: general scope
  const pageNames: Record<string, string> = {
    "/projects": "Projects",
    "/invoices": "Invoices",
    "/contacts": "Contacts",
    "/notes": "Notes",
    "/calendar": "Calendar",
    "/gallery": "Gallery",
    "/maps": "Maps",
    "/settings": "Settings",
    "/expenses": "Expenses",
    "/reports": "Reports",
  };
  
  const pageName = Object.entries(pageNames).find(([path]) => location.startsWith(path))?.[1] || "Mantodeus";
  
  return (
    <AssistantPanel
      scope="general"
      pageName={pageName}
    />
  );
}
