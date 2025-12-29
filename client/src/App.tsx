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
import Reports from "./pages/Reports";
import Calendar from "./components/Calendar";
import Contacts from "./pages/Contacts";
import ContactsArchived from "./pages/ContactsArchived";
import ContactsRubbish from "./pages/ContactsRubbish";
import Invoices from "./pages/Invoices";
import InvoicesArchived from "./pages/InvoicesArchived";
import InvoicesRubbish from "./pages/InvoicesRubbish";
import InvoiceCreate from "./pages/InvoiceCreate";
import Notes from "./pages/Notes";
import NotesArchived from "./pages/NotesArchived";
import NotesRubbish from "./pages/NotesRubbish";
import NoteDetail from "./pages/NoteDetail";
import Maps from "./pages/Maps";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Inspections from "./pages/Inspections";
import InspectionsOverview from "./pages/InspectionsOverview";
import InspectionUnitDetail from "./pages/InspectionUnitDetail";
import Expenses from "./pages/Expenses";
import ExpenseDetail from "./pages/ExpenseDetail";
import ScanReceipt from "./pages/ScanReceipt";
import { useEffect } from "react";
import { initializeTheme } from "@/lib/theme";

function Router() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Handle routing based on auth state - no redirects, just set location
  // Note: useEffect must be called unconditionally (before any early returns)
  // to comply with React's Rules of Hooks
  useEffect(() => {
    // Don't redirect while still loading
    if (loading) return;
    
    if (!user) {
      // Not authenticated - ensure we're on login page
      if (location !== "/login") {
        setLocation("/login");
      }
    } else {
      // Authenticated - if on login page, go to projects
      if (location === "/login") {
        setLocation("/projects");
      }
    }
  }, [user, loading, location, setLocation]);

  // Show loading screen during initial auth check
  if (loading) {
    return <AppLoadingScreen />;
  }

  // Show loading screen briefly while routing
  if (!user && location !== "/login") {
    return <AppLoadingScreen />;
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
      <Route path="/invoices/new">
        <DashboardLayout>
          <InvoiceCreate />
        </DashboardLayout>
      </Route>
      <Route path="/invoices">
        <DashboardLayout>
          <Invoices />
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
      <Route path="/notes">
        <DashboardLayout>
          <Notes />
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
      <Route path="/maps">
        <DashboardLayout>
          <Maps />
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
