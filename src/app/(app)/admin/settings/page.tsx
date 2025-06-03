
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSession, type SessionData } from "@/app/login/actions";
import { getOwnerEmailsAction, addOwnerEmailAction, removeOwnerEmailAction } from "./actions";
import { Loader2, PlusCircle, Trash2, ShieldAlert, UserCog } from "lucide-react";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSessionAndEmails() {
      setIsLoadingPage(true);
      const currentSession = await getSession();
      setSession(currentSession);

      if (!currentSession || currentSession.role !== "owner") {
        toast({ title: "Access Denied", description: "You do not have permission to view this page.", variant: "destructive" });
        router.push("/dashboard");
        return;
      }
      
      await fetchEmails();
      setIsLoadingPage(false);
    }
    fetchSessionAndEmails();
  }, [router, toast]);

  async function fetchEmails() {
    setIsLoadingEmails(true);
    try {
      const emails = await getOwnerEmailsAction();
      setOwnerEmails(emails);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load owner emails.", variant: "destructive" });
    } finally {
      setIsLoadingEmails(false);
    }
  }

  const handleAddOwnerEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newOwnerEmail) {
      toast({ title: "Input Error", description: "Please enter an email address.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const result = await addOwnerEmailAction(newOwnerEmail);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setNewOwnerEmail("");
      await fetchEmails(); // Refresh the list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleRemoveOwnerEmail = async (emailToRemove: string) => {
    setIsSubmitting(true); // Use general submitting state or a specific one per item
    const result = await removeOwnerEmailAction(emailToRemove);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchEmails(); // Refresh the list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading admin settings...</p>
      </div>
    );
  }

  if (!session || session.role !== "owner") {
    // This case should be handled by redirection in useEffect, but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground mt-2">You do not have the necessary permissions to view this page.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <UserCog className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Settings</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Owner Emails</CardTitle>
          <CardDescription>
            Add or remove email addresses for users who should have 'owner' privileges.
            Owners have full access to all features, including these settings.
            Other users will be assigned the 'staff' role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddOwnerEmail} className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="newOwnerEmail">New Owner Email</Label>
              <Input
                id="newOwnerEmail"
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={isSubmitting}
              />
            </div>
            <Button type="submit" disabled={isSubmitting || !newOwnerEmail}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Owner
            </Button>
          </form>

          <div className="space-y-3">
            <h3 className="text-lg font-medium text-foreground">Current Owners:</h3>
            {isLoadingEmails ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading emails...
              </div>
            ) : ownerEmails.length === 0 ? (
              <p className="text-muted-foreground">
                No owner emails configured. Add an email above to grant owner access.
                Remember to set up the initial owner email directly in Firestore if this is the first time.
              </p>
            ) : (
              <ul className="space-y-2">
                {ownerEmails.map((email) => (
                  <li key={email} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                    <span className="text-sm font-medium">{email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOwnerEmail(email)}
                      disabled={isSubmitting}
                      className="text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${email} as owner`}
                    >
                      <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
             {ownerEmails.length === 1 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>To change the sole owner, add the new owner's email first, then remove the current one. The last owner cannot be removed directly.</span>
                </p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
             <CardTitle className="text-base text-muted-foreground">Initial Setup Note</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                If you are setting up the application for the first time and cannot access this page,
                ensure you have manually added your email to the `ownerEmails` array in the
                `app_settings/role_management` document in your Firestore database.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
