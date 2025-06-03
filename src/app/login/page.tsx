
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { loginAction } from "./actions";
import { APP_NAME } from "@/lib/constants";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = await loginAction(formData);

    if (result.success) {
      toast({ title: "Login Successful", description: "Welcome back!" });
      router.push("/dashboard"); // Redirect to dashboard on successful login
      router.refresh(); // Important to re-trigger middleware/layout checks
    } else {
      setError(result.error || "An unknown error occurred.");
      toast({ title: "Login Failed", description: result.error, variant: "destructive" });
    }
    setIsLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="text-2xl font-bold">{APP_NAME} Login</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="owner or staff"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
       <p className="mt-4 text-xs text-muted-foreground">
        Hint: Use username <code className="bg-muted px-1 py-0.5 rounded">owner</code> or <code className="bg-muted px-1 py-0.5 rounded">staff</code> with password <code className="bg-muted px-1 py-0.5 rounded">password</code>.
      </p>
    </div>
  );
}
