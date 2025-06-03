
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
      // If logoutAction completes successfully, it will redirect.
      // Code here might not be reached if redirect is synchronous.
      // The "Logged Out" toast is removed as it's unlikely to be seen.
    } catch (error: any) {
      const errorMessage = String(error?.message || error?.name || error?.toString() || "Unknown logout error");
      if (errorMessage.toUpperCase().includes("NEXT_REDIRECT")) {
        // This is an expected outcome for a server-side redirect.
        // The browser should handle the redirect.
        console.warn("Logout initiated server-side redirect, caught by client:", error);
        // isLoggingOut will remain true, component might unmount.
      } else {
        // This is an actual unexpected error during logout.
        console.error("Logout failed:", error);
        toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
        setIsLoggingOut(false);
      }
    }
    // If not a NEXT_REDIRECT error and not other error, it implies successful execution.
    // However, redirect should have happened. If execution reaches here without redirect or known error,
    // it's an unusual state. Setting isLoading to false in the specific error case above is safer.
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
