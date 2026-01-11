import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_TITLE } from "@/const";
import { Logo } from "@/components/Logo";
import { useIsMobile } from "@/hooks/useMobile";
import { LogOut, PanelLeft, FileText, Calendar as CalendarIcon, Users, File, MapPin, FileJson, FolderOpen, Settings as SettingsIcon, Receipt, ClipboardCheck, DocumentCurrencyEuro, BugAnt, Image, Camera, Microphone } from "@/components/ui/Icon";
import { DataExportImportDialog } from "./DataExportImportDialog";
import { FloatingHelpButton } from "./assistant/FloatingHelpButton";
import { AssistantPanel } from "./assistant/AssistantPanel";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AppLoadingScreen } from './AppLoadingScreen';
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import {
  MobileNavProvider,
  BottomTabBar,
  ModuleScroller,
  ScrollerOverlay,
  useRouteTracking,
} from "./mobile-nav";

// Grouped menu items matching mobile's Office / Action / Tools hierarchy
const menuGroups = {
  office: {
    label: "Office",
    items: [
      { icon: FolderOpen, label: "Projects", path: "/projects", shortcut: "1" },
      { icon: ClipboardCheck, label: "Inspections", path: "/inspections", shortcut: "2" },
      { icon: DocumentCurrencyEuro, label: "Invoices", path: "/invoices", shortcut: "3" },
      { icon: Receipt, label: "Expenses", path: "/expenses", shortcut: "4" },
      { icon: FileText, label: "Reports", path: "/reports", shortcut: "5" },
      { icon: File, label: "Notes", path: "/notes", shortcut: "6" },
    ],
  },
  action: {
    label: "Action",
    items: [
      { icon: Camera, label: "Capture", path: "/action/capto", shortcut: "7" },
      { icon: Microphone, label: "Record", path: "/action/voco", shortcut: "8" },
    ],
  },
  tools: {
    label: "Tools",
    items: [
      { icon: CalendarIcon, label: "Calendar", path: "/calendar", shortcut: "9" },
      { icon: Users, label: "Contacts", path: "/contacts", shortcut: "0" },
      { icon: Image, label: "Gallery", path: "/gallery" },
      { icon: MapPin, label: "Maps", path: "/maps" },
      { icon: SettingsIcon, label: "Settings", path: "/settings" },
    ],
  },
};

// Flat list for keyboard shortcuts
const allMenuItems = [
  ...menuGroups.office.items,
  ...menuGroups.action.items,
  ...menuGroups.tools.items,
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

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
    <MobileNavProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </MobileNavProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  // Keyboard shortcuts for quick navigation (Cmd/Ctrl + 1-9, 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when Cmd/Ctrl is pressed
      if (!e.metaKey && !e.ctrlKey) return;
      
      // Don't interfere with input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const key = e.key;
      
      // Find matching menu item by shortcut
      const matchingItem = allMenuItems.find(item => item.shortcut === key);
      if (matchingItem) {
        e.preventDefault();
        setLocation(matchingItem.path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                    <Logo
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                      alt="Logo"
                    />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <Logo
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border shrink-0"
                      alt="Logo"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2">
            {/* Office Group */}
            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                {menuGroups.office.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {menuGroups.office.items.map(item => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={cn(
                          "h-9 transition-all duration-150 font-normal relative",
                          isActive && [
                            "bg-primary/10 text-primary font-medium",
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                            "before:w-[3px] before:h-5 before:bg-primary before:rounded-r-full",
                            "shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]",
                          ]
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-transform duration-150",
                            isActive && "text-primary scale-110"
                          )}
                        />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-[10px] text-muted-foreground/40 group-data-[collapsible=icon]:hidden">
                            ⌘{item.shortcut}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator className="my-1 opacity-50" />

            {/* Action Group */}
            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                {menuGroups.action.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {menuGroups.action.items.map(item => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={cn(
                          "h-9 transition-all duration-150 font-normal relative",
                          isActive && [
                            "bg-primary/10 text-primary font-medium",
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                            "before:w-[3px] before:h-5 before:bg-primary before:rounded-r-full",
                            "shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]",
                          ]
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-transform duration-150",
                            isActive && "text-primary scale-110"
                          )}
                        />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-[10px] text-muted-foreground/40 group-data-[collapsible=icon]:hidden">
                            ⌘{item.shortcut}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator className="my-1 opacity-50" />

            {/* Tools Group */}
            <SidebarGroup className="py-2">
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                {menuGroups.tools.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {menuGroups.tools.items.map(item => {
                  const isActive = location === item.path || location.startsWith(item.path + "/");
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={cn(
                          "h-9 transition-all duration-150 font-normal relative",
                          isActive && [
                            "bg-primary/10 text-primary font-medium",
                            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                            "before:w-[3px] before:h-5 before:bg-primary before:rounded-r-full",
                            "shadow-[0_0_12px_-2px_hsl(var(--primary)/0.3)]",
                          ]
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-transform duration-150",
                            isActive && "text-primary scale-110"
                          )}
                        />
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-auto text-[10px] text-muted-foreground/40 group-data-[collapsible=icon]:hidden">
                            ⌘{item.shortcut}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <div className="flex items-center gap-2">
              {/* Manto Assistant Button */}
              <FloatingHelpButton inSidebar />
              
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors flex-1 text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9 border shrink-0">
                      <AvatarFallback className="text-xs font-medium">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Hidden by default, shown in dropdown */}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* User info shown in dropdown */}
                  <div className="px-2 py-2 mb-1">
                    <p className="text-sm font-medium">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDataDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    <span>Export / Import Data</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="h-0" />
        )}
        <main className="app-content flex-1 min-w-0 min-h-0 overflow-y-auto p-4 md:pb-4">
          {children}
        </main>
      </SidebarInset>

      {/* Â§ 1.1: Mobile Navigation (Mobile only, Desktop unchanged) */}
      {isMobile && (
        <>
          <RouteTracker />
          <ScrollerOverlay />
          <ModuleScroller />
          <BottomTabBar />
        </>
      )}

      <DataExportImportDialog
        open={dataDialogOpen}
        onOpenChange={setDataDialogOpen}
      />

      {/* Manto Assistant Panel - available on both desktop and mobile */}
      <MantoAssistantWrapper />
    </>
  );
}

// Component to track route changes (only on mobile)
function RouteTracker() {
  useRouteTracking();
  return null;
}

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

      <main className="app-content flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
        {children}
      </main>

      {/* Mobile Navigation */}
      <ScrollerOverlay />
      <ModuleScroller />
      <BottomTabBar />
      
      {/* Manto Assistant Panel - available on mobile */}
      <MantoAssistantWrapper />
    </div>
  );
}

// Helper component to provide page context to AssistantPanel
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
