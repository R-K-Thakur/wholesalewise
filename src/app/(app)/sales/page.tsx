
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getSalesAction } from "./actions"; // Import the new action
import type { Sale } from "@/lib/types"; // Import the Sale type

export default async function SalesPage() {
  const sales: Sale[] = await getSalesAction(); // Fetch actual sales data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Sales Records</h1>
        <Button asChild>
          <Link href="/sales/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Record New Sale
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
          <CardDescription>View and manage all recorded sales transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement Sales Filters component */}
          <p className="text-muted-foreground mb-4">Sales filters (date range, type, etc.) placeholder</p>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ID / Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Items Sold</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Amount (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      <Link href={`/sales/${sale.id}`} className="hover:underline">
                        {sale.id.substring(0, 8)}...
                      </Link>
                      <br />
                      <span className="text-xs text-muted-foreground">{sale.customerName || "N/A"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">{sale.saleType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-center">{sale.items.length}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{sale.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(sale.saleDate).toLocaleDateString()}
                    </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/sales/${sale.id}`}>View Details</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                   <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">No sales recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* TODO: Implement Pagination component */}
           <p className="text-muted-foreground mt-4">Pagination placeholder</p>
        </CardContent>
      </Card>
    </div>
  );
}
