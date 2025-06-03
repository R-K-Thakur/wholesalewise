
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAction } from "./actions";
import { APP_NAME } from "@/lib/constants";
import { Loader2, LogIn, Mail } from "lucide-react";

export default function LoginPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (!email) {
      setError("Please enter your email address.");
      toast({ title: "Input Required", description: "Please enter your email address.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const serverResult = await signInWithEmailAction(email);

      if (serverResult?.error) { 
        setError(serverResult.error);
        toast({ title: "Login Failed", description: serverResult.error, variant: "destructive" });
      }
      // If server action redirects successfully, code here might not be reached or component unmounts.
    } catch (e: any) {
      console.error("Email Sign-In Error (client-side catch):", e);
      let errorMessage = "An unknown error occurred during Sign-In.";
      
      const errorString = String(e.message || e.name || e.toString()).toUpperCase();

      if (errorString.includes("NEXT_REDIRECT")) {
        console.warn("NEXT_REDIRECT error caught on client. This suggests the server attempted a redirect, but it propagated as an error. The browser might still redirect.");
        // Suppress generic error toast for NEXT_REDIRECT
      } else if (e.message) {
        errorMessage = e.message;
        setError(errorMessage);
        toast({ title: "Sign-In Failed", description: errorMessage, variant: "destructive" });
      } else {
        setError(errorMessage);
        toast({ title: "Sign-In Failed", description: errorMessage, variant: "destructive" });
      }
    } finally {
      // If a redirect was supposed to happen (even if it errored as NEXT_REDIRECT),
      // the component might unmount. Setting isLoading to false is generally safe.
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">{APP_NAME} Login</CardTitle>
          <CardDescription>Enter your email to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email" className="sr-only">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10"
                />
              </div>
            </div>
            <Button 
              type="submit"
              className="w-full" 
              disabled={isLoading || !email}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            {error && !error.toUpperCase().includes("NEXT_REDIRECT") && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>
       <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm">
        To gain 'owner' access, ensure the email you enter is listed in the `ownerEmails` array in the Firestore `app_settings/role_management` document.
      </p>
    </div>
  );
}
