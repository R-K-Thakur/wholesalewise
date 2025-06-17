
"use client";

import { useState, type FormEvent, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setOrChangeOwnerPinAction, finalizeLoginAfterPinSetup } from "../actions";
import { APP_NAME } from "@/lib/constants";
import { Loader2, KeyRound, ShieldPlus } from "lucide-react";

function SetupPinContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) {
      setEmail(decodeURIComponent(emailFromQuery));
    } else {
      toast({ title: "Error", description: "Email missing for PIN setup. Please log in again.", variant: "destructive" });
      router.push("/login");
    }
  }, [searchParams, router, toast]);

  async function handlePinSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      setError("Email is missing. Cannot set PIN.");
      toast({ title: "Setup Error", description: "Email is missing.", variant: "destructive" });
      return;
    }
    if (!pin || pin.length < 4 || pin.length > 8 || !/^\d+$/.test(pin)) {
      setError("PIN must be 4-8 digits.");
      toast({ title: "Input Required", description: "PIN must be 4-8 digits.", variant: "destructive" });
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      toast({ title: "Input Error", description: "PINs do not match.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // setOrChangeOwnerPinAction handles setting a new PIN when currentPin is not provided
      const setResult = await setOrChangeOwnerPinAction(pin); 
      if (setResult.success) {
        toast({ title: "PIN Set Successfully", description: "Your PIN has been set. Finalizing login...", variant: "default" });
        
        // Now finalize the login session
        const finalizeResult = await finalizeLoginAfterPinSetup(email);
        if (finalizeResult.success) {
            router.push("/dashboard");
        } else {
            setError(finalizeResult.error || "Failed to finalize login session after PIN setup.");
            toast({ title: "Login Error", description: finalizeResult.error || "Could not complete login.", variant: "destructive" });
            // Consider redirecting to login if finalization fails critically
            router.push("/login");
        }

      } else {
        setError(setResult.message || "Failed to set PIN.");
        toast({ title: "PIN Setup Failed", description: setResult.message || "Could not set PIN.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("PIN Setup Error (client-side catch):", e);
      const errorMessage = (e.message && !e.message.includes('NEXT_REDIRECT')) ? e.message : "An unknown error occurred during PIN setup.";
      setError(errorMessage);
      toast({ title: "Setup Failed", description: errorMessage, variant: "destructive" });
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
          <ShieldPlus className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">{APP_NAME} - Setup PIN</CardTitle>
          <CardDescription>Create a secure PIN for your account: {email}. This will be required for future logins.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePinSetup} className="space-y-4">
            <div>
              <Label htmlFor="pin">New PIN (4-8 digits)</Label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="pin"
                  name="pin"
                  type="password"
                  placeholder="Enter new PIN"
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
             <div>
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirmPin"
                  name="confirmPin"
                  type="password"
                  placeholder="Confirm new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
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
              disabled={isLoading || !pin || pin.length < 4 || !confirmPin || pin !== confirmPin}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set PIN & Log In
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

export default function SetupPinPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <SetupPinContent />
    </Suspense>
  )
}

