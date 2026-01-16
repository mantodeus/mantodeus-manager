import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { GuidanceProvider } from "./contexts/GuidanceContext";
import { MantoProvider } from "./contexts/MantoContext";
import DashboardLayout from "./components/DashboardLayout";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { useAuth } from "@/_core/hooks/useAuth";
// Project-based pages
import Projects from "./pages/Projects";
import ProjectsArchived from "./pages/ProjectsArchived";
import ProjectsRubbish from "./pages/ProjectsRubbish";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectJobDetail from "./pages/ProjectJobDetail";
import ProjectNew from "./pages/ProjectNew";
import Reports from "./pages/Reports";
import ReportsArchived from "./pages/ReportsArchived";
import ReportsRubbish from "./pages/ReportsRubbish";
import Calendar from "./components/Calendar";
import Contacts from "./pages/Contacts";
import ContactsArchived from "./pages/ContactsArchived";
import ContactsRubbish from "./pages/ContactsRubbish";
import Invoices from "./pages/Invoices";
import InvoicesArchived from "./pages/InvoicesArchived";
import InvoicesRubbish from "./pages/InvoicesRubbish";
import InvoiceCreate from "./pages/InvoiceCreate";
import InvoiceView from "./pages/InvoiceView";
import Notes from "./pages/Notes";
import NoteNew from "./pages/NoteNew";
import NotesArchived from "./pages/NotesArchived";
import NotesRubbish from "./pages/NotesRubbish";
import NoteDetail from "./pages/NoteDetail";
import Maps from "./pages/Maps";
import Gallery from "./pages/Gallery";
import Capture from "./pages/Capture";
import Record from "./pages/Record";
import MantoPage from "./pages/Manto";
import Statements from "./pages/Statements";
import Weather from "./pages/Weather";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Inspections from "./pages/Inspections";
import InspectionsOverview from "./pages/InspectionsOverview";
import InspectionUnitDetail from "./pages/InspectionUnitDetail";
import Expenses from "./pages/Expenses";
import ExpenseDetail from "./pages/ExpenseDetail";
import ScanReceipt from "./pages/ScanReceipt";
import DocumentUpload from "./pages/DocumentUpload";
import { useEffect, useState } from "react";
import { initializeTheme } from "@/lib/theme";

// #region agent log
// Helper to extract debug logs from localStorage (run in console: window.getDebugLogs())
if (typeof window !== 'undefined') {
  (window as any).getDebugLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
      console.table(logs);
      return logs;
    } catch(e) {
      console.error('Failed to get logs:', e);
      return [];
    }
  };
  (window as any).clearDebugLogs = () => {
    localStorage.removeItem('debug-logs');
    console.log('Debug logs cleared');
  };
  (window as any).toggleDebugPanel = () => {
    const panel = document.getElementById('debug-panel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    } else {
      createDebugPanel();
    }
  };
  
  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    const isMobile = window.innerWidth < 768;
    panel.style.cssText = `position:fixed;${isMobile ? 'bottom:0;left:0;right:0;width:100%;max-height:70vh;' : 'bottom:20px;right:20px;width:400px;max-height:500px;'}background:#1a1a1a;color:#fff;border:2px solid #00ff88;border-radius:${isMobile ? '16px 16px 0 0;' : '8px;'}padding:16px;z-index:99999;overflow-y:auto;font-family:monospace;font-size:${isMobile ? '11px' : '12px'};box-shadow:0 4px 20px rgba(0,0,0,0.5);`;
    
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #333;';
    header.innerHTML = '<strong style="color:#00ff88;">Debug Logs</strong><button id="debug-close" style="background:#ff4444;color:#fff;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;">Close</button>';
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
    controls.innerHTML = '<button id="debug-refresh" style="background:#00ff88;color:#000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:bold;">Refresh</button><button id="debug-clear" style="background:#ff8800;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Clear</button><button id="debug-copy" style="background:#0088ff;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Copy JSON</button>';
    
    const logContainer = document.createElement('div');
    logContainer.id = 'debug-log-container';
    logContainer.style.cssText = `max-height:${isMobile ? '50vh' : '400px'};overflow-y:auto;`;
    
    function updateLogs() {
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        logContainer.innerHTML = logs.length === 0 
          ? '<div style="color:#888;padding:8px;">No logs yet. Try opening a menu/dropdown.</div>'
          : logs.slice(-50).reverse().map((log: any, i: number) => {
              const time = new Date(log.timestamp).toLocaleTimeString();
              return `<div style="padding:8px;margin-bottom:4px;background:${i % 2 === 0 ? '#222' : '#1a1a1a'};border-left:3px solid #00ff88;">
                <div style="color:#00ff88;font-weight:bold;">[${time}] ${log.message}</div>
                <div style="color:#888;font-size:10px;margin-top:4px;">${log.location}</div>
                <details style="margin-top:4px;"><summary style="color:#aaa;cursor:pointer;">Data</summary><pre style="color:#ccc;margin:4px 0;white-space:pre-wrap;font-size:10px;">${JSON.stringify(log.data, null, 2)}</pre></details>
              </div>`;
            }).join('');
      } catch(e) {
        logContainer.innerHTML = `<div style="color:#ff4444;">Error: ${e}</div>`;
      }
    }
    
    updateLogs();
    
    header.querySelector('#debug-close')?.addEventListener('click', () => {
      panel.style.display = 'none';
    });
    
    controls.querySelector('#debug-refresh')?.addEventListener('click', updateLogs);
    controls.querySelector('#debug-clear')?.addEventListener('click', () => {
      localStorage.removeItem('debug-logs');
      updateLogs();
    });
    controls.querySelector('#debug-copy')?.addEventListener('click', () => {
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
        alert('Logs copied to clipboard!');
      } catch(e) {
        alert('Failed to copy: ' + e);
      }
    });
    
    panel.appendChild(header);
    panel.appendChild(controls);
    panel.appendChild(logContainer);
    document.body.appendChild(panel);
    
    // Auto-refresh every 2 seconds
    const interval = setInterval(updateLogs, 2000);
    panel.addEventListener('remove', () => clearInterval(interval));
  }
  
  // Add keyboard shortcut to toggle panel (Shift+D)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('keydown', (e) => {
      if (e.shiftKey && e.key === 'D') {
        e.preventDefault();
        (window as any).toggleDebugPanel();
      }
    });
    
    // Create floating button to open debug panel (mobile-friendly)
    // Only show if enabled in settings
    setTimeout(() => {
      // Check if debug panel is enabled (read directly from localStorage)
      const isEnabled = localStorage.getItem('debug-panel-enabled') === 'true';
      
      const button = document.createElement('button');
      button.id = 'debug-panel-toggle';
      button.innerHTML = '🐛';
      button.title = 'Debug Panel (or press Shift+D)';
      button.style.cssText = `position:fixed;bottom:80px;right:20px;width:50px;height:50px;background:#00ff88;color:#000;border:none;border-radius:50%;font-size:24px;z-index:99998;cursor:pointer;box-shadow:0 4px 12px rgba(0,255,136,0.4);display:${isEnabled ? 'flex' : 'none'};align-items:center;justify-content:center;`;
      button.addEventListener('click', () => {
        (window as any).toggleDebugPanel();
      });
      button.addEventListener('touchstart', (e) => {
        e.preventDefault();
        button.style.transform = 'scale(0.9)';
      });
      button.addEventListener('touchend', (e) => {
        e.preventDefault();
        button.style.transform = 'scale(1)';
        (window as any).toggleDebugPanel();
      });
      document.body.appendChild(button);
      
      // Listen for storage changes to update button visibility (cross-tab sync)
      window.addEventListener('storage', (e) => {
        if (e.key === 'debug-panel-enabled') {
          const enabled = e.newValue === 'true';
          button.style.display = enabled ? 'flex' : 'none';
        }
      });
      
      // Also listen for custom event for same-tab updates
      window.addEventListener('debug-panel-setting-changed', ((e: CustomEvent) => {
        const enabled = e.detail.enabled;
        button.style.display = enabled ? 'flex' : 'none';
      }) as EventListener);
    }, 1000);
  }
}

// Global scroll listener to track scroll changes
if (typeof window !== 'undefined') {
  let lastWindowScrollY = window.scrollY;
  let lastAppContentScrollTop: number | null = null;
  let lastVisualViewportHeight: number | null = null;
  let lastVisualViewportOffsetTop: number | null = null;
  const appContent = document.querySelector('.app-content') as HTMLElement | null;
  if (appContent) {
    lastAppContentScrollTop = appContent.scrollTop;
  }
  const vv = (window as any).visualViewport;
  if (vv) {
    lastVisualViewportHeight = vv.height;
    lastVisualViewportOffsetTop = vv.offsetTop;
  }
  
  const handleScroll = () => {
    const currentWindowScrollY = window.scrollY;
    const currentAppContent = document.querySelector('.app-content') as HTMLElement | null;
    const currentAppContentScrollTop = currentAppContent?.scrollTop ?? null;
    const currentVv = (window as any).visualViewport;
    const currentVvHeight = currentVv?.height ?? null;
    const currentVvOffsetTop = currentVv?.offsetTop ?? null;
    
    const scrollChanged = currentWindowScrollY !== lastWindowScrollY || currentAppContentScrollTop !== lastAppContentScrollTop;
    const viewportChanged = currentVvHeight !== lastVisualViewportHeight || currentVvOffsetTop !== lastVisualViewportOffsetTop;
    
    if (scrollChanged || viewportChanged) {
      const isMobile = window.innerWidth < 768;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      const logData = {location:'App.tsx:scroll',message:scrollChanged?'Scroll detected':'VisualViewport changed',data:{isMobile,isStandalone,windowScrollY:currentWindowScrollY,windowScrollYDelta:currentWindowScrollY-lastWindowScrollY,appContentScrollTop:currentAppContentScrollTop,appContentScrollTopDelta:currentAppContentScrollTop!==null&&lastAppContentScrollTop!==null?currentAppContentScrollTop-lastAppContentScrollTop:null,windowInnerHeight:window.innerHeight,visualViewportHeight:currentVvHeight,visualViewportHeightDelta:currentVvHeight!==null&&lastVisualViewportHeight!==null?currentVvHeight-lastVisualViewportHeight:null,visualViewportOffsetTop:currentVvOffsetTop,visualViewportOffsetTopDelta:currentVvOffsetTop!==null&&lastVisualViewportOffsetTop!==null?currentVvOffsetTop-lastVisualViewportOffsetTop:null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'G'};
      console.log('[DEBUG]', logData);
      try {
        const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
        logs.push(logData);
        if (logs.length > 100) logs.shift();
        localStorage.setItem('debug-logs', JSON.stringify(logs));
      } catch(e) {}
      fetch('http://127.0.0.1:7242/ingest/7f3ab1cf-d324-4ab4-82d2-e71b2fb5152e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch((e)=>console.warn('[DEBUG] Fetch failed:', e));
      lastWindowScrollY = currentWindowScrollY;
      lastAppContentScrollTop = currentAppContentScrollTop;
      lastVisualViewportHeight = currentVvHeight;
      lastVisualViewportOffsetTop = currentVvOffsetTop;
    }
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
  if (appContent) {
    appContent.addEventListener('scroll', handleScroll, { passive: true });
  }
  // iOS PWA uses visualViewport for viewport changes
  if (vv) {
    vv.addEventListener('resize', handleScroll, { passive: true });
    vv.addEventListener('scroll', handleScroll, { passive: true });
  }
  
  // Also monitor for layout shifts (Performance Observer) - iOS PWA can shift layout without scroll events
  if ('PerformanceObserver' in window) {
    try {
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            const isMobile = window.innerWidth < 768;
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
            const appContent = document.querySelector('.app-content') as HTMLElement | null;
            const vv = (window as any).visualViewport;
            const logData = {location:'App.tsx:layout-shift',message:'Layout shift detected',data:{isMobile,isStandalone,value:(entry as any).value,windowScrollY:window.scrollY,windowInnerHeight:window.innerHeight,visualViewportHeight:vv?.height,visualViewportOffsetTop:vv?.offsetTop,appContentScrollTop:appContent?.scrollTop},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'I'};
            console.log('[DEBUG]', logData);
            try {
              const logs = JSON.parse(localStorage.getItem('debug-logs') || '[]');
              logs.push(logData);
              if (logs.length > 100) logs.shift();
              localStorage.setItem('debug-logs', JSON.stringify(logs));
            } catch(e) {}
          }
        }
      });
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
    } catch(e) {
      console.warn('[DEBUG] Layout shift observer not supported:', e);
    }
  }
}
// #endregion

const LAST_ROUTE_KEY = "mantodeus-last-route";

// Routes that should not be saved/restored
const EXCLUDED_ROUTES = ["/login", "/404", "/"];

// Detect if we're in Cursor browser
const isCursorBrowser = typeof navigator !== "undefined" && 
  (navigator.userAgent.includes("Cursor") || 
   navigator.userAgent.includes("cursor"));

function Router() {
  const { user, loading, queryStatus, isQueryComplete } = useAuth();
  const [location, setLocation] = useLocation();
  const [hasRestoredRoute, setHasRestoredRoute] = useState(false);
  // For Cursor browser, add a manual bypass after 3 seconds
  const [cursorBypass, setCursorBypass] = useState(false);

  // Cursor browser workaround: allow bypass after 3 seconds
  useEffect(() => {
    if (isCursorBrowser && loading && !cursorBypass) {
      const timer = setTimeout(() => {
        console.warn("[Router] Cursor browser detected - bypassing loading after 3s");
        setCursorBypass(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isCursorBrowser, loading, cursorBypass]);

  // If query is complete (success or error), we're done loading regardless of loading state
  // This fixes the issue where query completes but loading state hasn't updated yet
  const actuallyLoading = loading && !isQueryComplete;

  // Save current route to localStorage when it changes (for authenticated users only)
  useEffect(() => {
    if (!user || actuallyLoading) return;
    if (EXCLUDED_ROUTES.includes(location)) return;
    
    try {
      localStorage.setItem(LAST_ROUTE_KEY, location);
    } catch (error) {
      console.warn("[Router] Failed to save last route:", error);
    }
  }, [location, user, actuallyLoading]);

  // Restore last route on app startup (only once)
  useEffect(() => {
    if (actuallyLoading || hasRestoredRoute) return;
    
    if (!user) {
      // Not authenticated - only redirect to login if we're not already there
      // Don't redirect from "/" to avoid loops during session restoration
      if (location !== "/login" && location !== "/") {
        setLocation("/login");
      }
      setHasRestoredRoute(true);
      return;
    }

    // Authenticated - restore last route or default to projects
    // Restore if we're on login page or "/" (initial load)
    if (location === "/login" || location === "/") {
      try {
        const lastRoute = localStorage.getItem(LAST_ROUTE_KEY);
        if (lastRoute && !EXCLUDED_ROUTES.includes(lastRoute)) {
          setLocation(lastRoute);
        } else {
          setLocation("/projects");
        }
      } catch (error) {
        console.warn("[Router] Failed to restore last route:", error);
        setLocation("/projects");
      }
      setHasRestoredRoute(true);
    } else {
      // Already on a route - just mark as restored
      setHasRestoredRoute(true);
    }
  }, [user, actuallyLoading, location, setLocation, hasRestoredRoute]);

  // Show loading screen during initial auth check
  // Wait for auth to load before making routing decisions
  // Note: useAuth has an 8-second timeout to prevent infinite loading
  // Cursor browser workaround: bypass loading after 3 seconds
  // Also add a general fallback: if loading for more than 5 seconds total, proceed anyway
  // CRITICAL: If query is complete (success/error), don't show loading even if loading state is true
  const [maxLoadingTime] = useState(() => Date.now());
  const loadingTooLong = Date.now() - maxLoadingTime > 5000;
  
  // Don't show loading if:
  // 1. Query is complete (success or error) - this is the key fix
  // 2. Cursor browser bypass is active
  // 3. Loading has been too long
  const shouldShowLoading = actuallyLoading && !(isCursorBrowser && cursorBypass) && !loadingTooLong;
  
  if (shouldShowLoading) {
    return <AppLoadingScreen />;
  }
  
  // If we've been loading too long or query is complete, log and proceed
  if (loading && ((isCursorBrowser && cursorBypass) || loadingTooLong || isQueryComplete)) {
    console.warn("[Router] Proceeding despite loading state", {
      isCursorBrowser,
      cursorBypass,
      loadingTooLong,
      isQueryComplete,
      queryStatus,
      hasUser: !!user,
    });
  }

  // If not authenticated and the auth query is complete, go to login immediately.
  // Avoid showing the loading screen here (Cursor/PWA can get stuck).
  if (!user && isQueryComplete && location !== "/login") {
    setLocation("/login");
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <DashboardLayout>
          <Projects />
        </DashboardLayout>
      </Route>
      
      {/* New project-based routes */}
      <Route path="/projects">
        <DashboardLayout>
          <Projects />
        </DashboardLayout>
      </Route>
      <Route path="/projects/archived">
        <DashboardLayout>
          <ProjectsArchived />
        </DashboardLayout>
      </Route>
      <Route path="/projects/rubbish">
        <DashboardLayout>
          <ProjectsRubbish />
        </DashboardLayout>
      </Route>
      <Route path="/projects/new">
        <DashboardLayout>
          <ProjectNew />
        </DashboardLayout>
      </Route>
      <Route path="/projects/:id">
        <DashboardLayout>
          <ProjectDetail />
        </DashboardLayout>
      </Route>
      <Route path="/projects/:projectId/jobs/:jobId">
        <DashboardLayout>
          <ProjectJobDetail />
        </DashboardLayout>
      </Route>
      <Route path="/inspections">
        <DashboardLayout>
          <InspectionsOverview />
        </DashboardLayout>
      </Route>
      <Route path="/projects/:projectId/inspections">
        <DashboardLayout>
          <Inspections />
        </DashboardLayout>
      </Route>
      <Route path="/projects/:projectId/inspections/units/:unitId">
        <DashboardLayout>
          <InspectionUnitDetail />
        </DashboardLayout>
      </Route>
      <Route path="/reports">
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path="/reports/archived">
        <DashboardLayout>
          <ReportsArchived />
        </DashboardLayout>
      </Route>
      <Route path="/reports/rubbish">
        <DashboardLayout>
          <ReportsRubbish />
        </DashboardLayout>
      </Route>
      <Route path="/statements">
        <DashboardLayout>
          <Statements />
        </DashboardLayout>
      </Route>
      <Route path="/calendar">
        <DashboardLayout>
          <Calendar />
        </DashboardLayout>
      </Route>
      <Route path="/contacts">
        <DashboardLayout>
          <Contacts />
        </DashboardLayout>
      </Route>
      <Route path="/contacts/archived">
        <DashboardLayout>
          <ContactsArchived />
        </DashboardLayout>
      </Route>
      <Route path="/contacts/rubbish">
        <DashboardLayout>
          <ContactsRubbish />
        </DashboardLayout>
      </Route>
      <Route path="/invoices/upload">
        <DashboardLayout>
          <DocumentUpload />
        </DashboardLayout>
      </Route>
      <Route path="/invoices/new">
        <DashboardLayout>
          <InvoiceCreate />
        </DashboardLayout>
      </Route>
      <Route path="/invoices/archived">
        <DashboardLayout>
          <InvoicesArchived />
        </DashboardLayout>
      </Route>
      <Route path="/invoices/rubbish">
        <DashboardLayout>
          <InvoicesRubbish />
        </DashboardLayout>
      </Route>
      <Route path="/invoices/:id">
        <DashboardLayout>
          <InvoiceView />
        </DashboardLayout>
      </Route>
      <Route path="/invoices">
        <DashboardLayout>
          <Invoices />
        </DashboardLayout>
      </Route>
      <Route path="/notes">
        <DashboardLayout>
          <Notes />
        </DashboardLayout>
      </Route>
      <Route path="/notes/new">
        <DashboardLayout>
          <NoteNew />
        </DashboardLayout>
      </Route>
      <Route path="/notes/archived">
        <DashboardLayout>
          <NotesArchived />
        </DashboardLayout>
      </Route>
      <Route path="/notes/rubbish">
        <DashboardLayout>
          <NotesRubbish />
        </DashboardLayout>
      </Route>
      <Route path="/notes/:id">
        <DashboardLayout>
          <NoteDetail />
        </DashboardLayout>
      </Route>
      <Route path="/action/manto">
        <DashboardLayout>
          <MantoPage />
        </DashboardLayout>
      </Route>
      <Route path="/action/capto">
        <DashboardLayout>
          <Capture />
        </DashboardLayout>
      </Route>
      <Route path="/action/voco">
        <DashboardLayout>
          <Record />
        </DashboardLayout>
      </Route>
      <Route path="/gallery">
        <DashboardLayout>
          <Gallery />
        </DashboardLayout>
      </Route>
      <Route path="/maps">
        <DashboardLayout>
          <Maps />
        </DashboardLayout>
      </Route>
      <Route path="/weather">
        <DashboardLayout>
          <Weather />
        </DashboardLayout>
      </Route>
      <Route path="/expenses">
        <DashboardLayout>
          <Expenses />
        </DashboardLayout>
      </Route>
      <Route path="/expenses/scan">
        <DashboardLayout>
          <ScanReceipt />
        </DashboardLayout>
      </Route>
      <Route path="/expenses/:id">
        <DashboardLayout>
          <ExpenseDetail />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  // Initialize theme on app load
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        // switchable
      >
        <GuidanceProvider>
          <MantoProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </MantoProvider>
        </GuidanceProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
