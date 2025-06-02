
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Mock data for products table - replace with actual data fetching and ProductsTable component
const mockProducts = [
  { id: "1", name: "Lavender Lipstick", category: "Makeup", quantity: 150, price: 999.00 },
  { id: "2", name: "Teal Hair Oil", category: "Hair Oils", quantity: 80, price: 650.00 },
  { id: "3", name: "Silver Earrings", category: "Imitation Jewellery", quantity: 200, price: 1999.00 },
];

interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  price: number;
}

export default function ProductsPage() {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (productToDelete) {
      console.log("Deleting product:", productToDelete.name);
      // Here you would typically call an API to delete the product
      // For now, we'll just log and close the dialog
    }
    setProductToDelete(null);
    setIsDeleteDialogOpen(false);
  };

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
                      <Button variant="outline" size="sm" className="mr-2" asChild>
                        <Link href={`/products/${product.id}/edit`}>Edit</Link>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(product)}>
                        Delete
                      </Button>
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

      {productToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the product
                "{productToDelete.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
