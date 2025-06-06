
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSession, type SessionData } from "@/app/login/actions";
import { 
  getOwnerEmailsAction, addOwnerEmailAction, removeOwnerEmailAction,
  getStaffEmailsAction, addStaffEmailAction, removeStaffEmailAction
  // Removed getPendingStaffAction, approveStaffLoginAction, denyStaffLoginAction
} from "@/app/(app)/admin/actions";
import { Loader2, PlusCircle, Trash2, ShieldAlert, UserCog, Users } from "lucide-react"; 
// Removed UserCheck, UserX, Clock as they were for the approval section

// Interface PendingStaffUser removed

export default function AdminSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  
  const [ownerEmails, setOwnerEmails] = useState<string[]>([]);
  const [isLoadingOwnerEmails, setIsLoadingOwnerEmails] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);

  const [staffEmails, setStaffEmails] = useState<string[]>([]);
  const [isLoadingStaffEmails, setIsLoadingStaffEmails] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);

  // State for staff login approvals removed
  // const [pendingStaffList, setPendingStaffList] = useState<PendingStaffUser[]>([]);
  // const [isLoadingPendingStaff, setIsLoadingPendingStaff] = useState(false);
  // const [isSubmittingApproval, setIsSubmittingApproval] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSessionAndData() {
      setIsLoadingPage(true);
      const currentSession = await getSession();
      setSession(currentSession);

      if (!currentSession || currentSession.role !== "owner") {
        toast({
          title: "Access Denied",
          description: "You do not have permission to view this page.",
          variant: "destructive"
        });
        router.push("/login"); 
        return;
      }
      
      // Removed fetchPendingStaff from Promise.all
      await Promise.all([fetchOwnerEmails(), fetchStaffEmails()]);
      setIsLoadingPage(false);
    }
    fetchSessionAndData();
  }, [router, toast]);

  async function fetchOwnerEmails() {
    setIsLoadingOwnerEmails(true);
    try {
      const emails = await getOwnerEmailsAction();
      setOwnerEmails(emails);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load owner emails.", variant: "destructive" });
    } finally {
      setIsLoadingOwnerEmails(false);
    }
  }

  async function fetchStaffEmails() {
    setIsLoadingStaffEmails(true);
    try {
      const emails = await getStaffEmailsAction();
      setStaffEmails(emails);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load staff emails.", variant: "destructive" });
    } finally {
      setIsLoadingStaffEmails(false);
    }
  }

  // Removed fetchPendingStaff function

  const handleAddOwnerEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newOwnerEmail) return;
    setIsSubmittingOwner(true);
    const result = await addOwnerEmailAction(newOwnerEmail);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setNewOwnerEmail("");
      await fetchOwnerEmails();
      await fetchStaffEmails(); 
      // await fetchPendingStaff(); // Removed
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingOwner(false);
  };

  const handleRemoveOwnerEmail = async (emailToRemove: string) => {
    setIsSubmittingOwner(true);
    const result = await removeOwnerEmailAction(emailToRemove);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchOwnerEmails();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingOwner(false);
  };
  
  const handleAddStaffEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newStaffEmail) return;
    setIsSubmittingStaff(true);
    const result = await addStaffEmailAction(newStaffEmail);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setNewStaffEmail("");
      await fetchStaffEmails(); 
      // await fetchPendingStaff(); // Removed
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingStaff(false);
  };

  const handleRemoveStaffEmail = async (emailToRemove: string) => {
    setIsSubmittingStaff(true);
    const result = await removeStaffEmailAction(emailToRemove);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchStaffEmails();
      // await fetchPendingStaff(); // Removed
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingStaff(false);
  };

  // Removed handleApproveStaff and handleDenyStaff functions

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading admin settings...</p>
      </div>
    );
  }
  
  if (!session || session.role !== 'owner') {
    return null; 
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <UserCog className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">Admin Settings</h1>
      </div>

      {/* Staff Login Approvals Card Removed */}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-6 w-6" />Manage Owner Access</CardTitle>
          <CardDescription>
            Add or remove emails for 'owner' privileges. Owners have full access to the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddOwnerEmail} className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="newOwnerEmail" className="sr-only">New Owner Email</Label>
              <Input
                id="newOwnerEmail"
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="owner@example.com"
                disabled={isSubmittingOwner}
              />
            </div>
            <Button type="submit" disabled={isSubmittingOwner || !newOwnerEmail}>
              {isSubmittingOwner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Owner
            </Button>
          </form>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Current Owners:</h3>
            {isLoadingOwnerEmails ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading owner emails...
              </div>
            ) : ownerEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No owner emails configured. Add an email to grant owner access.
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
                      disabled={isSubmittingOwner}
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
                    <span>To change the sole owner, add the new owner's email first, then remove the current one.</span>
                </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" />Manage Staff Access</CardTitle>
          <CardDescription>
            Add or remove emails for 'staff' privileges. Staff added here can log in directly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleAddStaffEmail} className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="newStaffEmail" className="sr-only">New Staff Email</Label>
              <Input
                id="newStaffEmail"
                type="email"
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="staff@example.com"
                disabled={isSubmittingStaff}
              />
            </div>
            <Button type="submit" disabled={isSubmittingStaff || !newStaffEmail}>
              {isSubmittingStaff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Staff
            </Button>
          </form>

          <div className="space-y-3">
            <h3 className="text-base font-medium text-foreground">Current Staff:</h3>
            {isLoadingStaffEmails ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading staff emails...
              </div>
            ) : staffEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff emails configured. Add an email to grant staff access.
              </p>
            ) : (
              <ul className="space-y-2">
                {staffEmails.map((email) => (
                  <li key={email} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                    <span className="text-sm font-medium">{email}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveStaffEmail(email)}
                      disabled={isSubmittingStaff}
                      className="text-destructive hover:bg-destructive/10"
                      aria-label={`Remove ${email} as staff`}
                    >
                      <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </li>
                ))}
              </ul>
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
                If you are setting up the application for the first time, ensure you have manually added your email to the `ownerEmails` array 
                (and optionally, an empty `staffEmails` array) in the `app_settings/role_management` document in your Firestore database.
                Your user document in the `users` collection should also have `loginApprovalStatus: "approved"` (though this field is no longer actively used by the reverted login system, it's good practice if it was set previously).
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

    