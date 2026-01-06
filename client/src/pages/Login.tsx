import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { setAuthToken } from "@/lib/authToken";
import { APP_TITLE } from "@/const";
import { Logo } from "@/components/Logo";
import { Loader2 } from "@/components/ui/Icon";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

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

      // Step 2: Get the access token from the session
      const session = signInResult.data?.session;
      if (!session?.access_token) {
        throw new Error("Failed to get session token after login");
      }
      setAuthToken(session.access_token);

      // Step 3: Set the session cookie on the backend
      const callbackResponse = await fetch("/api/auth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important: include cookies
        body: JSON.stringify({
          access_token: session.access_token,
        }),
      });

      if (!callbackResponse.ok) {
        const errorData = await callbackResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to set session cookie: ${callbackResponse.statusText}`
        );
      }

      // Step 4: Wait a moment to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 200));

      // Step 5: Redirect to home - the Router will handle routing based on auth state
      // Avoid full reload to keep in-memory auth available in embedded browsers
      setLocation("/");
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
          <Logo
            alt={APP_TITLE}
            className="h-12 mx-auto mb-4"
          />
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
