
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signInWithGoogleAction } from "./actions";
import { APP_NAME } from "@/lib/constants";
import { auth } from "@/lib/firebase"; // Import Firebase auth instance
import { GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth";
import { Loader2, LogIn } from "lucide-react";

// Google SVG Icon (simplified)
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
    <path fill="none" d="M1 1h22v22H1z" />
  </svg>
);


export default function LoginPage() {
  const router = useRouter(); // Keep router for potential other uses, though not for this specific redirect
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);
    
    if (!auth) {
      const criticalErrorMsg = "Firebase is not configured correctly. Authentication cannot proceed. Please check your .env file and Firebase project setup.";
      setError(criticalErrorMsg);
      toast({ title: "Configuration Error", description: criticalErrorMsg, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        const serverResult = await signInWithGoogleAction({
          email: user.email,
          name: user.displayName,
          uid: user.uid,
        });

        if (serverResult.success) {
          toast({ title: "Login Successful", description: `Welcome, ${user.displayName || user.email}!` });
          // Use window.location.assign for a full page navigation to ensure cookie is sent
          window.location.assign('/dashboard');
          // router.push("/dashboard"); // Previous method
          // router.refresh(); // No longer needed with window.location.assign
        } else {
          setError(serverResult.error || "Failed to create session.");
          toast({ title: "Login Failed", description: serverResult.error, variant: "destructive" });
        }
      } else {
        throw new Error("No user information received from Google.");
      }
    } catch (e: any) {
      console.error("Google Sign-In Error:", e);
      let errorMessage = "An unknown error occurred during Google Sign-In.";
       if (e.code === 'auth/popup-closed-by-user') {
        errorMessage = "Sign-in cancelled. The Google Sign-In popup was closed.";
      } else if (e.code === 'auth/cancelled-popup-request') {
        errorMessage = "Sign-in cancelled. Multiple popup requests were made.";
      } else if (e.code === 'auth/configuration-not-found') {
         errorMessage = "Firebase authentication is not configured correctly for this project or the API key is invalid. Please ensure your API key and Project ID in the .env file are correct for your Firebase project, that Authentication is enabled in the Firebase console, and that your domain is authorized.";
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMessage = "This domain is not authorized for Google Sign-In. Please add it to the 'Authorized domains' list in your Firebase project's Authentication settings (Sign-in method tab).";
      } else if (e.message) {
        errorMessage = e.message;
      }
      setError(errorMessage);
      toast({ title: "Google Sign-In Failed", description: errorMessage, variant: "destructive" });
    } finally {
      // setIsLoading(false); // Don't set loading to false if navigating away
      // If navigation fails for some reason and stays on page, then we might need it.
      // For now, successful navigation means this component unmounts.
      // If an error occurs before navigation, setIsLoading will be set in the catch.
      // If serverResult.success is false, setIsLoading will also remain false.
      if(!serverResult?.success) { // Check if serverResult exists and was not successful
        setIsLoading(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">{APP_NAME} Login</CardTitle>
          <CardDescription>Sign in to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGoogleSignIn} 
            className="w-full" 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Sign in with Google
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
       <p className="mt-4 text-xs text-muted-foreground text-center max-w-sm">
        Ensure your Firebase project is correctly configured with API keys in the .env file, Authentication is enabled, and this domain is authorized. The Sign-in method in Firebase Authentication settings must also include Google.
      </p>
    </div>
  );
}
