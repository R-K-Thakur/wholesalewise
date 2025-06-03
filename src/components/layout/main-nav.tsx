
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Bell,
  PackagePlus,
  IndianRupee,
  UserCog, // Icon for Admin Settings
} from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { SessionData } from "@/app/login/actions"; // Import SessionData type

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<SessionData['role']>; // Optional roles to control visibility
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/products/new", label: "Add Product", icon: PackagePlus },
  { href: "/sales", label: "Sales", icon: IndianRupee },
  { href: "/alerts", label: "Reorder Alerts", icon: Bell },
  { href: "/admin/settings", label: "Admin Settings", icon: UserCog, roles: ["owner"] },
];

interface MainNavProps {
  userRole?: SessionData['role'];
}

export function MainNav({ userRole }: MainNavProps) {
  const pathname = usePathname();

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true; // Always show if no specific roles are defined
    return item.roles.includes(userRole || "staff"); // Show if user has one of the required roles, default to staff if no role
  });

  return (
    <SidebarMenu>
      {filteredNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin/settings" && pathname.startsWith(item.href)) || (item.href === "/admin/settings" && pathname.startsWith("/admin"))}
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
      ))}
    </SidebarMenu>
  );
}
