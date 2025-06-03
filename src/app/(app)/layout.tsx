
import type { ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { MainNav } from '@/components/layout/main-nav';
import { UserNav } from '@/components/layout/user-nav';
import { APP_NAME } from '@/lib/constants';
import { Leaf } from 'lucide-react'; // Using Leaf as a placeholder app icon
import { getSession, type SessionData } from '@/app/login/actions';


export default async function AppLayout({ children }: { children: ReactNode }) {
  const userSession: SessionData | null = await getSession();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <SidebarHeader className="p-4 flex items-center gap-2">
          <Leaf className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            {APP_NAME}
          </h1>
        </SidebarHeader>
        <SidebarContent>
          <MainNav />
        </SidebarContent>
        <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/70">&copy; {new Date().getFullYear()} {APP_NAME}</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" /> {/* Hidden on md+ as sidebar rail is visible */}
            {/* Page title could go here, dynamically set by pages */}
          </div>
          <UserNav user={userSession} />
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
