
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Edit } from "lucide-react";
import type { Product } from "@/lib/types";

interface DashboardProductSearchWidgetProps {
  products: Product[];
}

export function DashboardProductSearchWidget({ products: initialProducts }: DashboardProductSearchWidgetProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>([]);

  React.useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredProducts([]);
      return;
    }

    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
    const newFilteredProducts = initialProducts.filter(product => 
      product.name.toLowerCase().includes(lowercasedSearchTerm) ||
      product.category.toLowerCase().includes(lowercasedSearchTerm) ||
      (product.sku && product.sku.toLowerCase().includes(lowercasedSearchTerm))
    );
    setFilteredProducts(newFilteredProducts);
  }, [searchTerm, initialProducts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-6 w-6" />
          Quick Product Lookup
        </CardTitle>
        <CardDescription>
          Search for products to quickly view stock and price information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, category, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>

        {searchTerm.trim() !== "" && filteredProducts.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No products found matching your search.</p>
        )}

        {filteredProducts.length > 0 && (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {filteredProducts.map(product => (
              <div key={product.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-grow">
                  <h4 className="font-semibold text-foreground">{product.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Stock: {product.quantityInStock} {product.baseUnit}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
                    <p>Retail: ₹{product.retailPricePerBaseUnit.toFixed(2)} / {product.baseUnit}</p>
                    <p>Wholesale: ₹{product.wholesalePricePerBaseUnit.toFixed(2)} / {product.baseUnit}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="flex-shrink-0">
                  <Link href={`/products/${product.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    View/Edit
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
         {searchTerm.trim() === "" && (
          <p className="text-muted-foreground text-center py-4">Start typing to search for products.</p>
        )}
      </CardContent>
    </Card>
  );
}
