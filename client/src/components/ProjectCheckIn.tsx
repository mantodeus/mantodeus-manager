/**
 * Project Check-In Component
 * 
 * Allows users to check in/out of projects with optional geolocation.
 * Displays current check-in status and history.
 * Mobile-first design for field technicians.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Clock, MapPin, LogOut, LogIn, Loader2, History } from "@/components/ui/Icon";
import { toast } from "sonner";

interface ProjectCheckInProps {
  projectId: number;
}

export function ProjectCheckIn({ projectId }: ProjectCheckInProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const utils = trpc.useUtils();
  const isValidProjectId = Number.isFinite(projectId) && projectId > 0;

  useEffect(() => {
    if (!isValidProjectId && import.meta.env.DEV) {
      console.error("[ProjectCheckIn] Missing or invalid projectId", { projectId });
    }
  }, [isValidProjectId, projectId]);

  const { data: activeCheckin, isLoading: activeLoading } = trpc.projects.getActiveCheckin.useQuery(
    { projectId },
    { enabled: isValidProjectId }
  );
  const { data: checkins, isLoading: checkinsLoading } = trpc.projects.getCheckins.useQuery(
    { projectId },
    { enabled: isValidProjectId }
  );

  const checkInMutation = trpc.projects.checkIn.useMutation({
    onSuccess: () => {
      utils.projects.getActiveCheckin.invalidate({ projectId });
      utils.projects.getCheckins.invalidate({ projectId });
      toast.success("Checked in successfully");
      setIsCheckingIn(false);
    },
    onError: (error) => {
      toast.error("Failed to check in: " + error.message);
      setIsCheckingIn(false);
    },
  });

  const checkOutMutation = trpc.projects.checkOut.useMutation({
    onSuccess: () => {
      utils.projects.getActiveCheckin.invalidate({ projectId });
      utils.projects.getCheckins.invalidate({ projectId });
      toast.success("Checked out successfully");
      setIsCheckingOut(false);
    },
    onError: (error) => {
      toast.error("Failed to check out: " + error.message);
      setIsCheckingOut(false);
    },
  });

  const handleCheckIn = async () => {
    if (!isValidProjectId) {
      if (import.meta.env.DEV) {
        console.error("[ProjectCheckIn] Cannot check in without a valid projectId", { projectId });
      }
      return;
    }
    setIsCheckingIn(true);
    try {
      // Try to get geolocation (optional)
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (error) {
          // Geolocation failed, continue without it
          console.log("Geolocation not available or denied");
        }
      }

      await checkInMutation.mutateAsync({
        projectId,
        latitude,
        longitude,
      });
    } catch (error) {
      // Error already handled in mutation
    }
  };

  const handleCheckOut = async () => {
    if (!isValidProjectId) {
      if (import.meta.env.DEV) {
        console.error("[ProjectCheckIn] Cannot check out without a valid projectId", { projectId });
      }
      return;
    }
    if (!activeCheckin) return;
    setIsCheckingOut(true);
    await checkOutMutation.mutateAsync({
      projectId,
    });
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDuration = (checkIn: Date, checkOut: Date | null) => {
    if (!checkOut) return "—";
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Active Check-In Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Check-In Status
          </CardTitle>
          <CardDescription>
            Track your time on this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : activeCheckin ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-primary/10 border-primary/20">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground">Checked In</Badge>
                    <span className="text-sm text-muted-foreground">
                      Since {formatTime(activeCheckin.checkInTime)}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {formatDate(activeCheckin.checkInTime)}
                  </p>
                  {activeCheckin.latitude && activeCheckin.longitude && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                      <MapPin className="h-3 w-3" />
                      Location recorded
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleCheckOut}
                  disabled={!isValidProjectId || isCheckingOut}
                  variant="outline"
                  className="gap-2"
                >
                  {isCheckingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Check Out
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleCheckIn}
              disabled={!isValidProjectId || isCheckingIn}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {isCheckingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking In...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Check In
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Check-In History */}
      {checkins && checkins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Check-In History
            </CardTitle>
            <CardDescription>
              Past check-ins for this project
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkinsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {checkins.map((checkin) => (
                  <div
                    key={checkin.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {formatDate(checkin.checkInTime)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {formatTime(checkin.checkInTime)} - {checkin.checkOutTime ? formatTime(checkin.checkOutTime) : "Active"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Duration: {getDuration(checkin.checkInTime, checkin.checkOutTime)}
                      </p>
                    </div>
                    {checkin.checkOutTime ? (
                      <Badge variant="secondary" className="text-xs">
                        Completed
                      </Badge>
                    ) : (
                      <Badge className="bg-primary text-primary-foreground text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

