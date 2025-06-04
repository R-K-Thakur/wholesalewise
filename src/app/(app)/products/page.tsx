
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getProductsAction } from "./actions";
import { ProductListClientContent } from "./product-list-client-content";


export default async function ProductsPage() {
  const products = await getProductsAction();

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
          <CardDescription>View, edit, and manage your product inventory. Use the search below to filter products.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductListClientContent products={products} />
        </CardContent>
      </Card>
    </div>
  );
}

