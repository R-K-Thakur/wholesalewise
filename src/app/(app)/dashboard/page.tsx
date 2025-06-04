
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, ShoppingCart, IndianRupee, PlusCircle, Search, TrendingUp, History } from "lucide-react";
import { getProductsAction, getPurchasesAction } from "../products/actions"; // Added getPurchasesAction
import { getSalesAction } from "../sales/actions";
import type { Product, Purchase } from "@/lib/types"; // Added Purchase type
import type { Sale } from "@/lib/types";
import { LowStockWidget } from "./low-stock-widget";
import { getSession, type SessionData } from "@/app/login/actions";
import { DashboardProductSearchWidget } from "./dashboard-product-search-widget";
import { SalesTrendChart } from "./sales-trend-chart";
import { PurchaseHistoryChart } from "./purchase-history-chart"; // Import new chart


export default async function DashboardPage() {
  const userSession: SessionData | null = await getSession();
  const userRole = userSession?.role || 'staff'; // Default to 'staff' if no session or role

  const products: Product[] = await getProductsAction();
  const sales: Sale[] = await getSalesAction();
  const purchases: Purchase[] = await getPurchasesAction(); // Fetch purchases

  let totalRevenue = 0;
  let totalSalesUnits = 0;

  sales.forEach(sale => {
    totalRevenue += sale.totalAmount;
    sale.items.forEach(item => {
      totalSalesUnits += item.quantitySold;
    });
  });

  const totalProducts = products.length;

  const summaryData = {
    totalRevenue: totalRevenue,
    totalSales: totalSalesUnits,
    totalProducts: totalProducts,
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userRole !== 'staff' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{summaryData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        )}
        <Link href="/sales" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales (Units)</CardTitle>
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.totalSales.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/products" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products in Stock</CardTitle>
              <Package className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.totalProducts.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        </Link>
        <LowStockWidget products={products} />
      </div>

      <DashboardProductSearchWidget products={products} />

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Perform common tasks quickly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add New Product
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/sales/new">
              <PlusCircle className="mr-2 h-5 w-5" />
              Record New Sale
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-1">
        <SalesTrendChart sales={sales} />
        <PurchaseHistoryChart purchases={purchases} /> 
      </div>
       <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Recent activity feed placeholder (e.g., latest sales, purchases, stock updates)</p>
            {/* TODO: Add list of recent activities */}
          </CardContent>
        </Card>
    </div>
  );
}
