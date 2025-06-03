
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Bell,
  PackagePlus,
  // DollarSign, // Replaced with RupeeIcon
  // LineChart // Example, can be re-added if needed
} from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

// Custom Lucide icon for Rupee
const RupeeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="M6 13h12" />
    <path d="M6 18h12" />
    <path d="M18 13c0 4.418-3.134 8-7 8s-7-3.582-7-8c0-4.418 3.134-8 7-8s7 3.582 7 8Z" />
  </svg>
);


const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/products/new", label: "Add Product", icon: PackagePlus },
  // { href: "/purchases", label: "Purchases", icon: ShoppingCart }, // Removed Purchases link
  { href: "/sales", label: "Sales", icon: RupeeIcon },
  { href: "/alerts", label: "Reorder Alerts", icon: Bell },
  // Example additional links
  // { href: "/reports", label: "Reports", icon: LineChart },
  // { href: "/archive", label: "Archive", icon: Archive },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} passHref legacyBehavior>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
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
