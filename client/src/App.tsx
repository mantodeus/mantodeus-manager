import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
// Project-based pages
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectJobDetail from "./pages/ProjectJobDetail";
import Reports from "./pages/Reports";
import Calendar from "./components/Calendar";
import Contacts from "./pages/Contacts";
import Invoices from "./pages/Invoices";
import Notes from "./pages/Notes";
import Maps from "./pages/Maps";
import Login from "./pages/Login";

function Router() {
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
      <Route path="/maps">
        <DashboardLayout>
          <Maps />
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
