
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
import { RouteProgressBar } from '@/components/layout/route-progress';
import { APP_NAME } from '@/lib/constants';
import { Leaf } from 'lucide-react'; 
import { getSession, type SessionData } from '@/app/login/actions';


export default async function AppLayout({ children }: { children: ReactNode }) {
  const userSession: SessionData | null = await getSession();
  const userRole = userSession?.role;

  return (
    <SidebarProvider defaultOpen>
      <RouteProgressBar />
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <SidebarHeader className="p-4 flex items-center gap-2">
          <Leaf className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            {APP_NAME}
          </h1>
        </SidebarHeader>
        <SidebarContent>
          <MainNav userRole={userRole} />
        </SidebarContent>
        <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-sidebar-foreground/70">&copy; {new Date().getFullYear()} {APP_NAME}</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between border-b bg-background/90 backdrop-blur-md px-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <SidebarTrigger className="h-9 w-9" /> 
            <div className="flex items-center gap-2 md:hidden">
              <Leaf className="h-5 w-5 text-primary" />
              <span className="font-bold text-base tracking-tight">{APP_NAME}</span>
            </div>
          </div>
          <UserNav user={userSession} />
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
