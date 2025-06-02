import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

// Mock data for sales table
const mockSales = [
  { id: "1", customer: "Local Shop A", items: 2, totalAmount: 10500.00, type: "wholesale", date: "2024-07-20" },
  { id: "2", customer: "Retail Customer", items: 1, totalAmount: 999.00, type: "retail", date: "2024-07-19" },
];

export default function SalesPage() {
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
          {/* TODO: Implement SalesTable component */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer/Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Items Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {mockSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{sale.customer} ({sale.type})</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{sale.items}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">₹{sale.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{sale.date}</td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/sales/${sale.id}`}>View Details</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {mockSales.length === 0 && (
                   <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">No sales recorded yet.</td>
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
