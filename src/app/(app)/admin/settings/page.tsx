
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
  getStaffEmailsAction, addStaffEmailAction, removeStaffEmailAction,
  getPendingStaffAction, approveStaffLoginAction, denyStaffLoginAction // Import new actions
} from "@/app/(app)/admin/actions";
import { Loader2, PlusCircle, Trash2, ShieldAlert, UserCog, Users, UserCheck, UserX, Clock } from "lucide-react"; // Added icons
import { formatDistanceToNow } from "date-fns";


interface PendingStaffUser {
  email: string;
  displayName?: string;
  lastLoginRequestTimestamp?: string;
}

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

  // State for staff login approvals
  const [pendingStaffList, setPendingStaffList] = useState<PendingStaffUser[]>([]);
  const [isLoadingPendingStaff, setIsLoadingPendingStaff] = useState(false);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<string | null>(null); // Store email of staff being processed

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
      
      await Promise.all([fetchOwnerEmails(), fetchStaffEmails(), fetchPendingStaff()]);
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

  async function fetchPendingStaff() {
    setIsLoadingPendingStaff(true);
    try {
      const pending = await getPendingStaffAction();
      setPendingStaffList(pending);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load pending staff requests.", variant: "destructive" });
    } finally {
      setIsLoadingPendingStaff(false);
    }
  }
  
  const handleAddOwnerEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newOwnerEmail) return;
    setIsSubmittingOwner(true);
    const result = await addOwnerEmailAction(newOwnerEmail);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setNewOwnerEmail("");
      await fetchOwnerEmails();
      await fetchStaffEmails(); // Refresh staff if one was promoted
      await fetchPendingStaff(); // Refresh pending list in case an owner was added who was pending
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
      await fetchPendingStaff(); // Refresh pending list
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
      await fetchPendingStaff(); // Refresh pending list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingStaff(false);
  };

  const handleApproveStaff = async (email: string) => {
    setIsSubmittingApproval(email);
    const result = await approveStaffLoginAction(email);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchPendingStaff(); // Refresh the list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingApproval(null);
  };

  const handleDenyStaff = async (email: string) => {
    setIsSubmittingApproval(email);
    const result = await denyStaffLoginAction(email);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchPendingStaff(); // Refresh the list
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingApproval(null);
  };


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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="h-6 w-6" /> Staff Login Approvals</CardTitle>
          <CardDescription>
            Approve or deny login requests from staff members. Staff cannot log in until approved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingPendingStaff ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pending requests...
            </div>
          ) : pendingStaffList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending staff login requests.</p>
          ) : (
            <ul className="space-y-3">
              {pendingStaffList.map((staff) => (
                <li key={staff.email} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border rounded-md bg-muted/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">{staff.displayName || staff.email}</p>
                    {staff.displayName && staff.displayName !== staff.email && <p className="text-xs text-muted-foreground">{staff.email}</p>}
                    {staff.lastLoginRequestTimestamp && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3"/> 
                            Requested: {formatDistanceToNow(new Date(staff.lastLoginRequestTimestamp), { addSuffix: true })}
                        </p>
                    )}
                  </div>
                  <div className="flex gap-2 self-start sm:self-center flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApproveStaff(staff.email)}
                      disabled={isSubmittingApproval === staff.email}
                      className="text-green-600 border-green-600 hover:bg-green-500/10"
                    >
                      {isSubmittingApproval === staff.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDenyStaff(staff.email)}
                      disabled={isSubmittingApproval === staff.email}
                    >
                      {isSubmittingApproval === staff.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-1 h-4 w-4" />}
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-6 w-6" />Manage Owner Access</CardTitle>
          <CardDescription>
            Add or remove emails for 'owner' privileges. Owners have full access and can approve staff logins.
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
            Add or remove emails for 'staff' privileges. Staff added here will require login approval from an owner.
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
                No staff emails configured. Add an email to grant staff access (will require approval).
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
                Your user document in the `users` collection should also have `loginApprovalStatus: "approved"`.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
    

    