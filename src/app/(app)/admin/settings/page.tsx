
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
  getLoginTimeSettingsAction, updateLoginTimeSettingsAction
} from "@/app/(app)/admin/actions";
import { Loader2, PlusCircle, Trash2, ShieldAlert, UserCog, Users, Clock } from "lucide-react"; 


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

  const [staffLoginStartTime, setStaffLoginStartTime] = useState("09:00");
  const [staffLoginEndTime, setStaffLoginEndTime] = useState("23:00");
  const [isLoadingTimeSettings, setIsLoadingTimeSettings] = useState(false);
  const [isSubmittingTimeSettings, setIsSubmittingTimeSettings] = useState(false);


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
      
      await Promise.all([fetchOwnerEmails(), fetchStaffEmails(), fetchLoginTimeSettings()]);
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
  
  async function fetchLoginTimeSettings() {
    setIsLoadingTimeSettings(true);
    try {
      const settings = await getLoginTimeSettingsAction();
      setStaffLoginStartTime(settings.startTime);
      setStaffLoginEndTime(settings.endTime);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load login time settings.", variant: "destructive" });
    } finally {
      setIsLoadingTimeSettings(false);
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
      await fetchStaffEmails(); 
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
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingStaff(false);
  };

  const handleUpdateTimeSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingTimeSettings(true);
    const result = await updateLoginTimeSettingsAction(staffLoginStartTime, staffLoginEndTime);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      await fetchLoginTimeSettings(); // Re-fetch to confirm
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingTimeSettings(false);
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
          <CardTitle className="flex items-center gap-2"><UserCog className="h-6 w-6" />Manage Owner Access</CardTitle>
          <CardDescription>
            Add or remove emails for 'owner' privileges. Owners have full access to the application, including managing staff access.
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
          <CardTitle className="flex items-center gap-2"><Users className="h-6 w-6" />Manage Staff List</CardTitle>
          <CardDescription>
            Add or remove staff emails from the system. Login access for these staff members (enabled/disabled and time-based) is managed on the separate "Staff Access" page.
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
            <h3 className="text-base font-medium text-foreground">Current Staff Members:</h3>
            {isLoadingStaffEmails ? (
              <div className="flex items-center text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading staff emails...
              </div>
            ) : staffEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff emails configured. Add emails to build your staff list.
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
          <CardTitle className="flex items-center gap-2"><Clock className="h-6 w-6" />Staff Login Time Window</CardTitle>
          <CardDescription>
            Define the hours during which staff members are allowed to log in. Times are in 24-hour format (HH:MM).
            This applies only if their individual login access is enabled on the "Staff Access" page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTimeSettings ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading time settings...
            </div>
          ) : (
            <form onSubmit={handleUpdateTimeSettings} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="staffLoginStartTime">Login Start Time</Label>
                  <Input
                    id="staffLoginStartTime"
                    type="time"
                    value={staffLoginStartTime}
                    onChange={(e) => setStaffLoginStartTime(e.target.value)}
                    disabled={isSubmittingTimeSettings}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="staffLoginEndTime">Login End Time (Exclusive)</Label>
                  <Input
                    id="staffLoginEndTime"
                    type="time"
                    value={staffLoginEndTime}
                    onChange={(e) => setStaffLoginEndTime(e.target.value)}
                    disabled={isSubmittingTimeSettings}
                    className="w-full"
                  />
                   <p className="text-xs text-muted-foreground mt-1">
                    E.g., if set to 23:00, staff can login up to 22:59.
                  </p>
                </div>
              </div>
              <Button type="submit" disabled={isSubmittingTimeSettings || isLoadingTimeSettings}>
                {isSubmittingTimeSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Time Settings
              </Button>
            </form>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
             <CardTitle className="text-base text-muted-foreground">Initial Setup Note</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                If you are setting up the application for the first time, ensure you have manually added your email to the `ownerEmails` array 
                (and optionally, an empty `staffEmails` array, `staffLoginStartTime: "09:00"`, `staffLoginEndTime: "23:00"`) 
                in the `app_settings/role_management` document in your Firestore database.
                Your user document in the `users` collection (e.g., `users/youremail@example.com`) should also ideally exist with `loginManuallyDisabled: false`.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
