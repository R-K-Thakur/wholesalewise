
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, Loader2 } from "lucide-react";
import { logoutAction, type SessionData } from "@/app/login/actions";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";


interface UserNavProps {
  user: SessionData | null;
}

export function UserNav({ user }: UserNavProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutAction();
      // The redirect in logoutAction will handle navigation
      // router.refresh() might be needed if redirect doesn't trigger full reload of layout
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
      setIsLoggingOut(false);
    }
    // No need to setIsLoggingOut(false) if successful, as page will redirect.
  };

  if (!user) {
    // Optionally, render a login button or nothing if middleware handles redirection
    return null; 
  }

  const fallbackName = user.name || user.username;
  const fallbackInitial = fallbackName ? fallbackName.charAt(0).toUpperCase() : "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {/* Add a placeholder image for user avatar if desired */}
            {/* <AvatarImage src={user.avatarUrl || `https://placehold.co/100x100.png?text=${fallbackInitial}`} alt={fallbackName} /> */}
            <AvatarImage src={`https://placehold.co/100x100.png?text=${fallbackInitial}`} alt={fallbackName} data-ai-hint="user avatar" />
            <AvatarFallback>{fallbackInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || user.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email} ({user.role})
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
