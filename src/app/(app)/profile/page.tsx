
"use client";

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from "react";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Edit3, Save, Loader2, ImagePlus } from 'lucide-react';
import { getSession, updateUserDisplayNameAction, type SessionData } from "@/app/login/actions";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function UserProfilePage() {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    async function fetchUserSession() {
      setIsLoadingSession(true);
      const currentSession = await getSession();
      setSession(currentSession);
      if (currentSession) {
        setDisplayName(currentSession.name || currentSession.email || "");
      }
      setIsLoadingSession(false);
    }
    fetchUserSession();
  }, []);

  const handleNameChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!displayName.trim()) {
      toast({ title: "Error", description: "Display name cannot be empty.", variant: "destructive" });
      return;
    }
    if (displayName.trim() === (session?.name || session?.email)) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    const result = await updateUserDisplayNameAction(displayName.trim());
    if (result.success) {
      toast({ title: "Success", description: "Display name updated successfully." });
      const updatedSession = await getSession(); 
      setSession(updatedSession);
      if (updatedSession) setDisplayName(updatedSession.name || updatedSession.email || "");
      setIsEditingName(false);
    } else {
      toast({ title: "Error", description: result.message || "Failed to update display name.", variant: "destructive" });
    }
    setIsSavingName(false);
  };

  const handleComingSoonFeature = () => {
    toast({
      title: "Coming Soon!",
      description: "This feature is under development.",
    });
  };
  
  const avatarName = session?.name || session?.email || "User";
  const avatarInitial = avatarName.charAt(0).toUpperCase();


  if (isLoadingSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <User className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">My Profile</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>View and manage your profile details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">Email Address</Label>
            <Input id="email" value={session?.email || "Loading..."} readOnly disabled className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">Your email address is used for login and cannot be changed here.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="displayName" className="text-base">Display Name</Label>
              {!isEditingName && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditingName(true)}>
                  <Edit3 className="h-4 w-4 mr-2" /> Edit Name
                </Button>
              )}
            </div>
            {isEditingName ? (
              <form onSubmit={handleNameChangeSubmit} className="flex items-center gap-2">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isSavingName}
                  maxLength={50}
                  className="flex-grow"
                />
                <Button type="button" variant="outline" onClick={() => { setIsEditingName(false); if(session) setDisplayName(session.name || session.email || ""); }} disabled={isSavingName}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingName || !displayName.trim() || displayName.trim() === (session?.name || session?.email)}>
                  {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">Save</span>
                </Button>
              </form>
            ) : (
              <Input id="displayName" value={displayName || "Not set"} readOnly disabled className="bg-muted/50" />
            )}
            <p className="text-xs text-muted-foreground">This name will be displayed in the application.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Manage your avatar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
            {/* Current placeholder, replace with actual user.avatarUrl if implemented */}
            <AvatarImage src={`https://placehold.co/128x128.png?text=${avatarInitial}`} alt={avatarName} data-ai-hint="user avatar" />
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2 items-center sm:items-start">
            <Button onClick={handleComingSoonFeature}>
              <ImagePlus className="mr-2 h-4 w-4" /> Change Picture
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload a new profile picture. JPG, PNG, or GIF. Max 2MB.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Other Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            More profile settings like notification preferences will be available here in the future.
            Theme and display settings can be found on the <Link href="/settings" className="underline hover:text-primary">My Settings</Link> page.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="mt-4 self-start">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
