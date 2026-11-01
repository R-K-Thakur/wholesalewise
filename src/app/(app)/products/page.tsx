
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getProductsAction } from "./actions";
import { getSession } from "@/app/login/actions";
import { ProductListClientContent } from "./product-list-client-content";


export default async function ProductsPage() {
  const [products, session] = await Promise.all([
    getProductsAction(),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Manage Products</h1>
          <p className="text-sm text-muted-foreground">View and manage your product catalogue and inventory counts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/products/adjustments">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Stock Adjustments & Waste
            </Link>
          </Button>
          <Button asChild>
            <Link href="/products/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Product
            </Link>
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>View, edit, and manage your product inventory. Use the search below to filter products.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductListClientContent products={products} initialRole={session?.role} />
        </CardContent>
      </Card>
    </div>
  );
}

