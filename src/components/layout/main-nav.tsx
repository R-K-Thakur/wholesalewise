
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Bell,
  PackagePlus,
  IndianRupee,
  UserCog, 
  // UsersRound, // Icon for Staff Access Management removed
} from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { SessionData } from "@/app/login/actions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<SessionData['role']>; 
  exactMatch?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exactMatch: true },
  { href: "/products", label: "Products", icon: Package },
  { href: "/products/new", label: "Add Product", icon: PackagePlus },
  { href: "/sales", label: "Sales", icon: IndianRupee },
  { href: "/alerts", label: "Reorder Alerts", icon: Bell, exactMatch: true },
  { href: "/admin/settings", label: "Admin Settings", icon: UserCog, roles: ["owner"], exactMatch: true },
  // { href: "/admin/staff-access", label: "Staff Access", icon: UsersRound, roles: ["owner"], exactMatch: true }, // Removed
];

interface MainNavProps {
  userRole?: SessionData['role'];
}

export function MainNav({ userRole }: MainNavProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true; 
    return item.roles.includes(userRole || "staff"); 
  });

  return (
    <SidebarMenu>
      {filteredNavItems.map((item) => {
        let isActive = false;
        if (item.exactMatch) {
            isActive = pathname === item.href;
        } else {
            isActive = pathname.startsWith(item.href);
        }
        
        // Special handling for /admin settings sub-routes
        if (item.href === "/admin/settings" && pathname.startsWith("/admin/")) { // Simplified, as staff-access is removed
            isActive = true;
        }


        return (
            <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                asChild
                isActive={isActive}
                className="w-full justify-start"
                tooltip={{ children: item.label, side: "right", align: "center" }}
                >
                <a>
                    <item.icon className="h-5 w-5" />
                    <span className="truncate">{item.label}</span>
                </a>
                </SidebarMenuButton>
            </Link>
            </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

    
    

    