
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, PlusCircle, Search, TrendingUp, History, PackagePlus, IndianRupee, ClipboardList, AlertCircle, Users, Truck, RotateCcw, SlidersHorizontal } from "lucide-react";
import { getProductsAction, getPurchasesAction } from "../products/actions";
import { getSalesAction } from "../sales/actions";
import { getCustomersAction } from "../customers/actions";
import type { Product, Purchase, Sale, ActivityItem, Customer } from "@/lib/types";
import { LowStockWidget } from "./low-stock-widget";
import { getSession, type SessionData } from "@/app/login/actions";
import { DashboardProductSearchWidget } from "./dashboard-product-search-widget";
import { SalesTrendChart } from "./sales-trend-chart";
import { PurchaseHistoryChart } from "./purchase-history-chart";
import { RecentActivityWidget } from "./recent-activity-widget";
import { PendingPurchasePriceWidget } from "./pending-purchase-price-widget"; // New Import


export default async function DashboardPage() {
  const userSession: SessionData | null = await getSession();
  const userRole = userSession?.role || 'staff';

  const [products, sales, purchases, customers] = await Promise.all([
    getProductsAction(),
    getSalesAction(),
    getPurchasesAction(),
    getCustomersAction(),
  ]);

  let totalRevenue = 0;
  for (let i = 0; i < sales.length; i++) {
    totalRevenue += sales[i].totalAmount || 0;
  }

  let totalCustomerDues = 0;
  let customersWithDueCount = 0;
  for (let i = 0; i < customers.length; i++) {
    const due = customers[i].totalDue;
    if (due > 0.001) {
      totalCustomerDues += due;
      customersWithDueCount++;
    }
  }

  const totalProducts = products.length;
  const numberOfSaleTransactions = sales.length;

  const summaryData = {
    totalRevenue,
    totalProducts,
    numberOfSaleTransactions,
  };

  const MAX_ACTIVITY_ITEMS = 7;
  const productMap = new Map(products.map(p => [p.id, p]));

  // Slice top recent sales and purchases before merging to avoid processing huge arrays
  const recentSales = sales.slice(0, MAX_ACTIVITY_ITEMS);
  const recentPurchases = purchases.slice(0, MAX_ACTIVITY_ITEMS);

  const activityItems: ActivityItem[] = [];

  for (const sale of recentSales) {
    activityItems.push({
      id: sale.id,
      type: 'sale',
      date: sale.createdAt,
      description: `Sale of Rs. ${sale.totalAmount.toFixed(2)} to ${sale.customerName || 'N/A'}.`,
      amount: sale.totalAmount,
      link: `/sales/${sale.id}`,
      recordedByEmail: sale.recordedByEmail,
      recordedByName: sale.recordedByName,
    });
  }

  for (const purchase of recentPurchases) {
    const product = productMap.get(purchase.productId);
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
      recordedByName: purchase.recordedByName,
    });
  }

  activityItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const recentActivities = activityItems.slice(0, MAX_ACTIVITY_ITEMS);


  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">Dashboard Overview</h1>

      {userRole === 'owner' && (
         <PendingPurchasePriceWidget products={products} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <Link href="/customers" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full border-l-4 border-l-destructive">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Dues</CardTitle>
              <Users className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                Rs. {totalCustomerDues.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {customersWithDueCount} customer{customersWithDueCount === 1 ? '' : 's'} with due
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/sales" className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No. of Sales</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.numberOfSaleTransactions.toLocaleString('en-IN')}</div>
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
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/sales/new">
              <IndianRupee className="mr-2 h-4 w-4" />
              Record Sale
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/sales/returns/new">
              <RotateCcw className="mr-2 h-4 w-4 text-primary" />
              Process Return
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/purchases/new">
              <Truck className="mr-2 h-4 w-4" />
              Inward Stock (Purchase)
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/products/adjustments">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Adjust Stock / Waste
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/customers">
              <Users className="mr-2 h-4 w-4" />
              Customers & Dues
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
