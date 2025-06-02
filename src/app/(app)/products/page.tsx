import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";

// Mock data for products table - replace with actual data fetching and ProductsTable component
const mockProducts = [
  { id: "1", name: "Lavender Lipstick", category: "Makeup", quantity: 150, price: 999.00 },
  { id: "2", name: "Teal Hair Oil", category: "Hair Oils", quantity: 80, price: 650.00 },
  { id: "3", name: "Silver Earrings", category: "Imitation Jewellery", quantity: 200, price: 1999.00 },
];


export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Manage Products</h1>
        <Button asChild>
          <Link href="/products/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add New Product
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>View, edit, and manage your product inventory. Use filters to narrow down your search.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement Product Filters component */}
          <p className="text-muted-foreground mb-4">Product filters (category, stock level, etc.) placeholder</p>
          
          {/* TODO: Implement ProductsTable component */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Retail Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {mockProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">₹{product.price.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button variant="outline" size="sm" className="mr-2">Edit</Button>
                      <Button variant="destructive" size="sm">Delete</Button>
                    </td>
                  </tr>
                ))}
                {mockProducts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-muted-foreground">No products found.</td>
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
