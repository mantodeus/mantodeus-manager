import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { APP_TITLE, APP_LOGO } from "@/const";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const utils = trpc.useUtils();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Sign in with Supabase
      let signInResult;
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInResult.error) throw signInResult.error;
      } else {
        signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInResult.error) throw signInResult.error;
      }

      // Step 2: Get the session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Failed to get session after login");
      }

      // Step 3: Sync session with server by calling the callback endpoint
      console.log("[Login] Syncing session with server...");
      const callbackResponse = await fetch("/api/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: session.access_token }),
        credentials: "include",
      });

      if (!callbackResponse.ok) {
        const errorData = await callbackResponse.json().catch(() => ({ error: "Unknown error" }));
        console.error("[Login] Callback failed:", callbackResponse.status, errorData);
        throw new Error(errorData.error || `Server error: ${callbackResponse.status}`);
      }

      console.log("[Login] Session synced successfully");

      // Step 4: Verify authentication by calling auth.me
      // Use direct fetch with Authorization header to ensure it works in Cursor browser
      // (which may have cookie issues)
      console.log("[Login] Verifying authentication...");
      const verifyResponse = await fetch("/api/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (!verifyResponse.ok) {
        const errorText = await verifyResponse.text();
        console.error("[Login] auth.me verification failed:", verifyResponse.status, errorText);
        throw new Error("Authentication verification failed. Please try again.");
      }

      const verifyData = await verifyResponse.json();
      const userData = verifyData[0]?.result?.data;

      if (!userData) {
        console.error("[Login] auth.me returned null after sync");
        throw new Error("Authentication verification failed. Please try again.");
      }

      console.log("[Login] Authentication verified, user:", userData.id);

      // Step 5: Invalidate tRPC cache so useAuth hook picks up the new user
      await utils.auth.me.invalidate();
      
      // Step 6: Router will handle redirect automatically when user state updates
      // No need to manually redirect - App.tsx Router will detect the user and redirect
      // Clear loading state - Router will redirect shortly
      setLoading(false);
    } catch (err: any) {
      console.error("[Login] Authentication error:", err);
      // Provide more specific error messages
      let errorMessage = "An error occurred";
      if (err.message) {
        errorMessage = err.message;
      } else if (err.error) {
        errorMessage = err.error;
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          {APP_LOGO && (
            <img
              src={APP_LOGO}
              alt={APP_TITLE}
              className="h-12 mx-auto mb-4"
            />
          )}
          <CardTitle className="text-2xl font-bold">{APP_TITLE}</CardTitle>
          <CardDescription>
            {isSignUp ? "Create a new account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? "Creating account..." : "Signing in..."}
                </>
              ) : (
                isSignUp ? "Sign Up" : "Sign In"
              )}
            </Button>
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-primary hover:underline"
                disabled={loading}
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
