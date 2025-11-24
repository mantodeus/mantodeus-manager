import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Circle, Clock, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo: number | null;
  dueDate: Date | null;
  createdAt: Date;
}

interface TaskListProps {
  tasks: Task[];
  jobId: number;
}

export function TaskList({ tasks, jobId }: TaskListProps) {
  const utils = trpc.useUtils();
  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: () => {
      utils.tasks.listByJob.invalidate({ jobId });
    },
    onError: (error) => {
      toast.error("Failed to update task: " + error.message);
    },
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: () => {
      utils.tasks.listByJob.invalidate({ jobId });
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete task: " + error.message);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "in_progress":
        return <Clock className="h-5 w-5 text-accent" />;
      case "review":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive text-destructive-foreground";
      case "high":
        return "bg-yellow-600 text-white";
      case "medium":
        return "bg-secondary text-secondary-foreground";
      case "low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-primary text-primary-foreground";
      case "in_progress":
        return "bg-accent text-accent-foreground";
      case "review":
        return "bg-yellow-600 text-white";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString();
  };

  const handleStatusChange = (taskId: number, newStatus: "todo" | "in_progress" | "review" | "completed") => {
    updateTask.mutate({ id: taskId, status: newStatus });
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTask.mutate({ id: taskId });
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card key={task.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {getStatusIcon(task.status)}
                <div className="flex-1">
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                <Badge className={getStatusColor(task.status)}>{task.status.replace("_", " ")}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
              </div>
              <div className="flex gap-2">
                {task.status !== "completed" && (
                  <>
                    {task.status === "todo" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(task.id, "in_progress")}
                      >
                        Start
                      </Button>
                    )}
                    {task.status === "in_progress" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(task.id, "review")}
                      >
                        Review
                      </Button>
                    )}
                    {task.status === "review" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(task.id, "completed")}
                      >
                        Complete
                      </Button>
                    )}
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
