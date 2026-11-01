
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Edit, DollarSign } from "lucide-react";
import type { Product } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PendingPurchasePriceWidgetProps {
  products: Product[];
}

export function PendingPurchasePriceWidget({ products }: PendingPurchasePriceWidgetProps) {
  const [pendingProducts, setPendingProducts] = React.useState<Product[]>([]);

  React.useEffect(() => {
    const filtered = products.filter(product => product.purchasePrice === undefined || product.purchasePrice <= 0);
    setPendingProducts(filtered);
  }, [products]);

  if (pendingProducts.length === 0) {
    return null; // Don't render the widget if no products are pending
  }

  return (
    <Card className="border-amber-500 dark:border-amber-400">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
          <AlertCircle className="h-6 w-6" />
          Action Required: Set Purchase Prices
        </CardTitle>
        <CardDescription>
          The following {pendingProducts.length} product(s) were added by staff and require a purchase price to be set by an owner for accurate cost tracking and reporting.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingProducts.length > 0 ? (
          <ScrollArea className="h-[200px] pr-3">
            <div className="space-y-3">
              {pendingProducts.map(product => (
                <div key={product.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex-grow">
                    <h4 className="font-semibold text-foreground">{product.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Category: {product.category}
                    </p>
                    <p className="text-xs text-destructive">
                      Current Purchase Price: Rs. {product.purchasePrice !== undefined ? product.purchasePrice.toFixed(2) : 'Not Set'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild className="flex-shrink-0 border-amber-500 text-amber-600 hover:bg-amber-500/10">
                    <Link href={`/products/${product.id}/edit`}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      Set Price
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-4">No products currently awaiting purchase price.</p>
        )}
      </CardContent>
    </Card>
  );
}
