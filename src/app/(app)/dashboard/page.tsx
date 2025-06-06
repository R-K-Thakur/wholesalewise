
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, ShoppingCart, PlusCircle, Search, TrendingUp, History, PackagePlus, IndianRupee, ClipboardList } from "lucide-react";
import { getProductsAction, getPurchasesAction } from "../products/actions";
import { getSalesAction } from "../sales/actions";
import type { Product, Purchase, Sale, ActivityItem } from "@/lib/types";
import { LowStockWidget } from "./low-stock-widget";
import { getSession, type SessionData } from "@/app/login/actions";
import { DashboardProductSearchWidget } from "./dashboard-product-search-widget";
import { SalesTrendChart } from "./sales-trend-chart";
import { PurchaseHistoryChart } from "./purchase-history-chart";
import { RecentActivityWidget } from "./recent-activity-widget";


export default async function DashboardPage() {
  console.time("DashboardPage_GetSession");
  const userSession: SessionData | null = await getSession();
  console.timeEnd("DashboardPage_GetSession");
  const userRole = userSession?.role || 'staff'; 

  console.time("DashboardPage_GetProductsAction");
  const products: Product[] = await getProductsAction();
  console.timeEnd("DashboardPage_GetProductsAction");

  console.time("DashboardPage_GetSalesAction");
  const sales: Sale[] = await getSalesAction();
  console.timeEnd("DashboardPage_GetSalesAction");

  console.time("DashboardPage_GetPurchasesAction");
  const purchases: Purchase[] = await getPurchasesAction(); 
  console.timeEnd("DashboardPage_GetPurchasesAction");

  console.time("DashboardPage_DataProcessing");
  let totalRevenue = 0;
  let totalSalesUnits = 0;

  sales.forEach(sale => {
    totalRevenue += sale.totalAmount;
    sale.items.forEach(item => {
      totalSalesUnits += item.quantitySold;
    });
  });

  const totalProducts = products.length;
  const numberOfSaleTransactions = sales.length;

  const summaryData = {
    totalRevenue: totalRevenue,
    totalSalesUnits: totalSalesUnits,
    totalProducts: totalProducts,
    numberOfSaleTransactions: numberOfSaleTransactions,
  };

  const MAX_ACTIVITY_ITEMS = 7;
  const activityItems: ActivityItem[] = [];

  sales.forEach(sale => {
    activityItems.push({
      id: sale.id,
      type: 'sale',
      date: sale.createdAt, 
      description: `Sale of Rs. ${sale.totalAmount.toFixed(2)} to ${sale.customerName || 'N/A'}.`,
      amount: sale.totalAmount,
      link: `/sales/${sale.id}`,
    });
  });

  purchases.forEach(purchase => {
    const product = products.find(p => p.id === purchase.productId);
    let desc = `Stock added for ${purchase.productNameSnapshot}: ${purchase.quantityPurchased} ${purchase.purchaseUnitSnapshot}.`;
    
    if (product && product.createdAt === purchase.createdAt && product.createdByEmail === purchase.recordedByEmail) {
       desc = `Initial stock for ${purchase.productNameSnapshot}: ${purchase.quantityPurchased} ${purchase.purchaseUnitSnapshot}.`;
    }
  
    activityItems.push({
      id: purchase.id, 
      type: 'purchase',
      date: purchase.createdAt, 
      description: desc,
      amount: purchase.totalCost,
      link: product ? `/products/${product.id}/edit` : undefined,
      recordedByEmail: purchase.recordedByEmail,
    });
  });

  activityItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentActivities = activityItems.slice(0, MAX_ACTIVITY_ITEMS);
  console.timeEnd("DashboardPage_DataProcessing");


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {userRole !== 'staff' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <IndianRupee className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rs. {summaryData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        )}
        <Link href="/sales" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No. of Sale Transactions</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.numberOfSaleTransactions.toLocaleString('en-IN')}</div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/sales" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales (Units)</CardTitle>
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.totalSalesUnits.toLocaleString('en-IN')}</div>
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

      {userRole !== 'staff' && (
        <div className="grid gap-4 md:grid-cols-2">
          <SalesTrendChart sales={sales} />
          <PurchaseHistoryChart purchases={purchases} /> 
        </div>
      )}
      
      <RecentActivityWidget activities={recentActivities} />
       
    </div>
  );
}
