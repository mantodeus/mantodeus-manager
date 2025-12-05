import { APP_LOGO } from "@/const";

export function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      {APP_LOGO && (
        <img
          src={APP_LOGO}
          alt="Loading"
          className="h-16 w-16 logo-loading"
        />
      )}
    </div>
  );
}
