
"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAction } from "./actions"; // Removed logoutAction as it's not used here
import { APP_NAME } from "@/lib/constants";
import { Loader2, LogIn, Mail } from "lucide-react";

const LOCALSTORAGE_REMEMBER_EMAIL_KEY = "rememberedUserEmail";

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const rememberedUserEmail = localStorage.getItem(LOCALSTORAGE_REMEMBER_EMAIL_KEY);
    if (rememberedUserEmail) {
      setEmail(rememberedUserEmail);
      setRememberEmail(true);
    }
  }, []);

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
      if (rememberEmail) {
        localStorage.setItem(LOCALSTORAGE_REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(LOCALSTORAGE_REMEMBER_EMAIL_KEY);
      }

      const serverResult = await signInWithEmailAction(email);

      if (serverResult?.success) {
        toast({ title: "Login Successful", description: "Redirecting to dashboard...", variant: "default" });
        router.push('/dashboard'); // Perform client-side redirect
      } else if (serverResult?.error) { 
        setError(serverResult.error);
        toast({ title: "Login Failed", description: serverResult.error, variant: "destructive" });
      } else {
        // This case should ideally not be reached if serverResult always has {success: boolean, error?: string}
        setError("An unexpected error occurred during login. Server response was unclear.");
        toast({ title: "Login Failed", description: "An unexpected error occurred. Server response was unclear.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Email Sign-In Error (client-side catch):", e);
      // Avoid showing generic NEXT_REDIRECT errors to the user directly if they occur
      const errorMessage = (e.message && !e.message.includes('NEXT_REDIRECT')) ? e.message : "An unknown error occurred during Sign-In.";
      setError(errorMessage);
      toast({ title: "Sign-In Failed", description: errorMessage, variant: "destructive" });
    } finally {
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
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
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
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember-email"
                checked={rememberEmail}
                onCheckedChange={(checked) => setRememberEmail(checked as boolean)}
                disabled={isLoading}
              />
              <Label
                htmlFor="remember-email"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Remember email
              </Label>
            </div>
            <Button 
              type="submit"
              className="w-full" 
              disabled={isLoading || !email}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>
       <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm">
        </p>
    </div>
  );
}


    
