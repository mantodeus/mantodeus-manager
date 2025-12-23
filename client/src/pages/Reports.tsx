import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Reports() {
  const { user } = useAuth();
  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const handleGenerateReport = (projectId: number, projectTitle: string) => {
    toast.info("Report generation feature coming soon");
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-regular">Reports</h1>
          <p className="text-muted-foreground text-sm">Generate and download project reports</p>
        </div>
      </div>

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
                        <p className="font-medium group-hover:text-accent-foreground transition-colors">{project.name || project.name}</p>
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
                <h3 className="font-semibold mb-2 group-hover:text-accent-foreground transition-colors">Daily Report</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Summary of daily activities, tasks completed, and progress updates
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="font-semibold mb-2 group-hover:text-accent-foreground transition-colors">Task Summary</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Overview of all tasks with status, priority, and assignments
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="font-semibold mb-2 group-hover:text-accent-foreground transition-colors">Progress Report</h3>
                <p className="text-sm group-hover:text-accent-foreground/80 text-muted-foreground transition-colors">
                  Detailed progress tracking with timeline and milestones
                </p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group">
                <h3 className="font-semibold mb-2 group-hover:text-accent-foreground transition-colors">Image Documentation</h3>
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
