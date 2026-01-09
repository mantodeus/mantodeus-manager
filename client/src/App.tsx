import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import InvoiceDetail from "./pages/InvoiceDetail";
import Notes from "./pages/Notes";
import NoteNew from "./pages/NoteNew";
import NotesArchived from "./pages/NotesArchived";
import NotesRubbish from "./pages/NotesRubbish";
import NoteDetail from "./pages/NoteDetail";
import Maps from "./pages/Maps";
import Gallery from "./pages/Gallery";
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
          <InvoiceDetail />
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
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
