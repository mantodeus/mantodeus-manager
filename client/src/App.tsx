import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Reports from "./pages/Reports";
import Calendar from "./components/Calendar";
import Contacts from "./pages/Contacts";
import Invoices from "./pages/Invoices";
import Notes from "./pages/Notes";
import Maps from "./pages/Maps";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <DashboardLayout>
          <Jobs />
        </DashboardLayout>
      </Route>
      <Route path="/jobs">
        <DashboardLayout>
          <Jobs />
        </DashboardLayout>
      </Route>
      <Route path="/jobs/:id">
        <DashboardLayout>
          <JobDetail />
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
