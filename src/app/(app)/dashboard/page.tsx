
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, AlertTriangle, IndianRupee } from "lucide-react";
import { getProductsAction } from "../products/actions";
import { getSalesAction } from "../sales/actions";
import type { Product } from "@/lib/types";
import type { Sale } from "@/lib/types";

// Define a default low stock threshold for products without a specific reorder threshold.
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

export default async function DashboardPage() {
  const products: Product[] = await getProductsAction();
  const sales: Sale[] = await getSalesAction();

  let totalRevenue = 0;
  let totalSalesUnits = 0;

  sales.forEach(sale => {
    totalRevenue += sale.totalAmount;
    sale.items.forEach(item => {
      totalSalesUnits += item.quantitySold;
    });
  });

  const totalProducts = products.length;

  const lowStockItems = products.filter(product => {
    const threshold = product.reorderThreshold !== undefined && product.reorderThreshold > 0 
                      ? product.reorderThreshold 
                      : DEFAULT_LOW_STOCK_THRESHOLD;
    return product.quantityInStock < threshold;
  }).length;

  const summaryData = {
    totalRevenue: totalRevenue,
    totalSales: totalSalesUnits,
    totalProducts: totalProducts,
    lowStockItems: lowStockItems,
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{summaryData.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {/* <p className="text-xs text-muted-foreground">+20.1% from last month</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales (Units)</CardTitle>
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalSales.toLocaleString('en-IN')}</div>
            {/* <p className="text-xs text-muted-foreground">+180.1% from last month</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products in Stock</CardTitle>
            <Package className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.totalProducts.toLocaleString('en-IN')}</div>
            {/* <p className="text-xs text-muted-foreground">+19 from last month</p> */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryData.lowStockItems.toLocaleString('en-IN')}</div>
            {/* <p className="text-xs text-muted-foreground">Needs attention</p> */}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Sales trend chart placeholder</p>
             {/* TODO: Add Chart component for sales trends */}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
             <p className="text-muted-foreground">Purchase history chart placeholder</p>
            {/* TODO: Add Chart component for purchase history */}
          </CardContent>
        </Card>
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
