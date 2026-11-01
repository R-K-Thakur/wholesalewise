"use client";

import { useState, type FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAction } from "./actions"; 
import { APP_NAME } from "@/lib/constants";
import { Loader2, LogIn, User, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";

const LOCALSTORAGE_REMEMBER_IDENTIFIER_KEY = "rememberedUserIdentifier";

export default function LoginPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberIdentifier, setRememberIdentifier] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem(LOCALSTORAGE_REMEMBER_IDENTIFIER_KEY);
    if (remembered) {
      setIdentifier(remembered);
      setRememberIdentifier(true);
    }
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    if (!identifier.trim()) {
      setError("Please enter your Staff ID or Email.");
      toast({ title: "Input Required", description: "Please enter your Staff ID or Email.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      if (rememberIdentifier) {
        localStorage.setItem(LOCALSTORAGE_REMEMBER_IDENTIFIER_KEY, identifier.trim());
      } else {
        localStorage.removeItem(LOCALSTORAGE_REMEMBER_IDENTIFIER_KEY);
      }

      const serverResult = await signInWithEmailAction(identifier.trim(), password);

      if (serverResult?.success) {
        if (serverResult.pinSetupRequired && serverResult.email) {
          toast({ title: "PIN Setup Required", description: "Please set up your PIN to secure your account.", variant: "default" });
          router.push(`/login/setup-pin?email=${encodeURIComponent(serverResult.email)}`);
        } else if (serverResult.pinRequired && serverResult.email) {
          toast({ title: "PIN Required", description: "Please enter your PIN to continue.", variant: "default" });
          router.push(`/login/verify-pin?email=${encodeURIComponent(serverResult.email)}`);
        } else {
          toast({ title: "Login Successful", description: "Redirecting to dashboard...", variant: "default" });
          router.push('/dashboard'); 
        }
      } else if (serverResult?.error) { 
        setError(serverResult.error);
        toast({ title: "Login Failed", description: serverResult.error, variant: "destructive" });
      } else {
        setError("An unexpected error occurred during login. Server response was unclear.");
        toast({ title: "Login Failed", description: "An unexpected error occurred. Server response was unclear.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Sign-In Error (client-side catch):", e);
      const errorMessage = (e.message && !e.message.includes('NEXT_REDIRECT')) ? e.message : "An unknown error occurred during Sign-In.";
      setError(errorMessage);
      toast({ title: "Sign-In Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center pb-4">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold font-headline">{APP_NAME} Login</CardTitle>
          <CardDescription>Enter your Staff ID or Email to sign in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="identifier">Staff ID or Email</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder="e.g. STF01 or owner@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-9"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password / Owner PIN</Label>
              </div>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Staff require password. Owners can enter PIN here or proceed to PIN screen.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember-identifier"
                  checked={rememberIdentifier}
                  onCheckedChange={(checked) => setRememberIdentifier(checked as boolean)}
                  disabled={isLoading}
                />
                <Label
                  htmlFor="remember-identifier"
                  className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Remember ID / Email
                </Label>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-10 font-semibold" 
              disabled={isLoading || !identifier.trim()}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {error}
              </div>
            )}
          </form>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border">
              <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Forgot your ID or Password?</strong> Please contact your Store Admin. Admins have instant access to view, copy, or reset all staff credentials in the Admin Dashboard.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
