import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

// Mock data for purchases table
const mockPurchases = [
  { id: "1", productName: "Lavender Lipstick", quantity: 50, totalCost: 17500.00, date: "2024-07-15" },
  { id: "2", productName: "Teal Hair Oil", quantity: 100, totalCost: 28000.00, date: "2024-07-10" },
];

export default function PurchasesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Purchase History</h1>
        <Button asChild>
          <Link href="/purchases/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Record New Purchase
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Purchases</CardTitle>
          <CardDescription>Track all stock purchases made for your inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement PurchasesTable component */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {mockPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{purchase.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{purchase.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">₹{purchase.totalCost.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{purchase.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm">View Details</Button>
                    </td>
                  </tr>
                ))}
                {mockPurchases.length === 0 && (
                   <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">No purchases recorded yet.</td>
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
