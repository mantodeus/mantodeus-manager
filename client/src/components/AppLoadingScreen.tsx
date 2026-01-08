import { Logo } from "@/components/Logo";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function AppLoadingScreen() {
  const [showTimeout, setShowTimeout] = useState(false);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    // Show timeout message after 5 seconds
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const elapsed = Date.now() - startTime;
  const isStuck = elapsed > 10000; // 10 seconds

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50 gap-4">
      <Logo
        alt="Loading"
        className="h-16 w-16 logo-loading"
        style={{
          animation: "logo-fade-in 0.5s ease-out, logo-bounce 1.5s ease-in-out 0.5s infinite",
        }}
      />
      {showTimeout && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <p>Taking longer than expected...</p>
          {isStuck && (
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Page
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
