import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Loader2, SlidersHorizontal, CheckCircle2, Archive, Trash2 } from "@/components/ui/Icon";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function Reports() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const handleGenerateReport = (projectId: number, projectTitle: string) => {
    toast.info("Report generation feature coming soon");
  };

  const filterSlot = (
    <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Filter reports">
          <SlidersHorizontal className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4 overflow-y-auto space-y-4 pt-4">
          {/* Status Buttons */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Status</div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  location === "/reports" && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => {
                  setLocation("/reports");
                  setIsFilterOpen(false);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Active
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  location === "/reports/archived" && "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => {
                  setLocation("/reports/archived");
                  setIsFilterOpen(false);
                }}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 w-full",
                  "hover:bg-destructive hover:text-destructive-foreground",
                  location === "/reports/rubbish" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={() => {
                  setLocation("/reports/rubbish");
                  setIsFilterOpen(false);
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Deleted
              </Button>
            </div>
          </div>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setIsFilterOpen(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate and download project reports"
        filterSlot={filterSlot}
      />

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Project Reports</CardTitle>
            <CardDescription>Generate comprehensive reports for your projects</CardDescription>
          </CardHeader>
          <CardContent>
            {projects && projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No projects available. Create a project first to generate reports.
              </p>
            ) : (
              <div className="space-y-3">
                {projects?.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 group-hover:text-accent-foreground text-muted-foreground transition-colors" />
                      <div>
                        <p className="group-hover:text-accent-foreground transition-colors">{project.name || project.name}</p>
                        <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                          Status: {project.status.replace("_", " ")}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateReport(project.id, project.name || project.name)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Templates</CardTitle>
            <CardDescription>Available report types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="mb-2 group-hover:text-accent-foreground transition-colors">Daily Report</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Summary of daily activities, tasks completed, and progress updates
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="mb-2 group-hover:text-accent-foreground transition-colors">Task Summary</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Overview of all tasks with status, priority, and assignments
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="mb-2 group-hover:text-accent-foreground transition-colors">Progress Report</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Detailed progress tracking with timeline and milestones
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="mb-2 group-hover:text-accent-foreground transition-colors">Image Documentation</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Collection of all uploaded images with captions and timestamps
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
