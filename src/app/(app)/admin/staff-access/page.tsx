
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSession, type SessionData } from "@/app/login/actions";
import { getStaffWithAccessStatusAction, toggleStaffLoginAccessAction } from "@/app/(app)/admin/actions";
import type { UserAccessDetails } from "@/lib/types";
import { Loader2, UsersRound, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";


export default function StaffAccessManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [staffList, setStaffList] = useState<UserAccessDetails[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null); // Stores email of staff being toggled

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
      
      await fetchStaffAccessInfo();
      setIsLoadingPage(false);
    }
    fetchSessionAndData();
  }, [router, toast]);

  async function fetchStaffAccessInfo() {
    setIsLoadingStaff(true);
    try {
      const staff = await getStaffWithAccessStatusAction();
      setStaffList(staff);
    } catch (error) {
      console.error("Error fetching staff access info:", error);
      toast({ title: "Error", description: "Failed to load staff access information.", variant: "destructive" });
    } finally {
      setIsLoadingStaff(false);
    }
  }

  const handleToggleLoginAccess = async (staffEmail: string, currentDisabledStatus: boolean) => {
    setIsToggling(staffEmail);
    const newDisabledState = !currentDisabledStatus;
    const result = await toggleStaffLoginAccessAction(staffEmail, newDisabledState);

    if (result.success) {
      toast({ title: "Success", description: result.message });
      // Optimistically update UI or re-fetch
      setStaffList(prevList => 
        prevList.map(staff => 
          staff.email === staffEmail ? { ...staff, loginManuallyDisabled: newDisabledState } : staff
        )
      );
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsToggling(null);
  };

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading staff access management...</p>
      </div>
    );
  }
  
  if (!session || session.role !== 'owner') {
    // This should ideally be caught by the useEffect redirect, but as a fallback.
    return null; 
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
         <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Dashboard</span>
          </Link>
        </Button>
        <UsersRound className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">Staff Login Access</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Manage Staff Logins</CardTitle>
          <CardDescription>
            Enable or disable login access for staff members. Staff can only log in if their access is enabled here AND it is between 9 AM - 11 PM (server time).
            Newly added staff have login enabled by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingStaff ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading staff list...
            </div>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff members found. You can add staff via the <Link href="/admin/settings" className="underline hover:text-primary">Admin Settings</Link> page.
            </p>
          ) : (
            <ul className="space-y-3">
              {staffList.map((staff) => (
                <li key={staff.email} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-md bg-muted/20 gap-4">
                  <div className="flex-grow">
                    <p className="text-base font-medium text-foreground">{staff.displayName}</p>
                    <p className="text-sm text-muted-foreground">{staff.email}</p>
                  </div>
                  <div className="flex items-center space-x-3 pt-2 sm:pt-0">
                    {isToggling === staff.email ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                       <Switch
                        id={`login-toggle-${staff.email}`}
                        checked={!staff.loginManuallyDisabled} // Switch is "on" if login is NOT disabled
                        onCheckedChange={() => handleToggleLoginAccess(staff.email, staff.loginManuallyDisabled)}
                        aria-label={`Toggle login access for ${staff.displayName}`}
                      />
                    )}
                    <Label htmlFor={`login-toggle-${staff.email}`} className="flex items-center text-sm">
                      {staff.loginManuallyDisabled ? 
                        <><ShieldOff className="h-4 w-4 mr-1.5 text-destructive"/> Disabled</> : 
                        <><ShieldCheck className="h-4 w-4 mr-1.5 text-green-600"/> Enabled</>
                      }
                    </Label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
