
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // For revalidating after delete
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/lib/types";
import { deleteProductAction } from "./actions";

interface ProductListClientContentProps {
  products: Product[];
}

export function ProductListClientContent({ products: initialProducts }: ProductListClientContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);

  // Update products if initialProducts prop changes (e.g., after server-side revalidation)
  React.useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      const result = await deleteProductAction(productToDelete.id);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        // Optimistically update UI or rely on revalidation
        setProducts(prevProducts => prevProducts.filter(p => p.id !== productToDelete.id));
        // router.refresh(); // Could also use this to re-fetch server component data
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to delete product.",
          variant: "destructive",
        });
      }
    }
    setProductToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Purchase (₹)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Wholesale (₹)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Retail (₹)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{product.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.category}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.quantityInStock}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{(product.purchasePrice || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{(product.wholesalePrice || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{(product.retailPrice || 0).toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.unit}</td>
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
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-muted-foreground">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
