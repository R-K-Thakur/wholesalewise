
"use client";

import { useState, type FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { verifyOwnerPinAction } from "../actions";
import { APP_NAME } from "@/lib/constants";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";

function VerifyPinContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery));
    } else {
      toast({ title: "Error", description: "Email missing for PIN verification. Please log in again.", variant: "destructive" });
      router.push("/login");
    }
  }, [searchParams, router, toast]);

  async function handlePinVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      setError("Email is missing. Cannot verify PIN.");
      toast({ title: "Verification Error", description: "Email is missing.", variant: "destructive" });
      return;
    }
    if (!pin || pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      toast({ title: "Input Required", description: "PIN must be at least 4 digits.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyOwnerPinAction(email, pin);
      if (result.success) {
        toast({ title: "PIN Verified", description: "Login successful. Redirecting to dashboard...", variant: "default" });
        router.push("/dashboard");
      } else {
        setError(result.error || "Invalid PIN or an unknown error occurred.");
        toast({ title: "PIN Verification Failed", description: result.error || "Invalid PIN.", variant: "destructive" });
        setPin(""); // Clear PIN input on failure
      }
    } catch (e: any) {
      console.error("PIN Verification Error (client-side catch):", e);
      const errorMessage = (e.message && !e.message.includes('NEXT_REDIRECT')) ? e.message : "An unknown error occurred.";
      setError(errorMessage);
      toast({ title: "Verification Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading user information...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">{APP_NAME} - Verify PIN</CardTitle>
          <CardDescription>Enter your PIN for {email} to complete login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePinVerification} className="space-y-4">
            <div>
              <Label htmlFor="pin">Owner PIN</Label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="pin"
                  name="pin"
                  type="password"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 tracking-wider"
                  maxLength={8}
                  minLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>
            <Button 
              type="submit"
              className="w-full" 
              disabled={isLoading || !pin || pin.length < 4}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify PIN & Log In
            </Button>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


export default function VerifyPinPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <VerifyPinContent />
    </Suspense>
  )
}
