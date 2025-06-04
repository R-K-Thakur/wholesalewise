
"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { Product } from '@/lib/types';
import Link from 'next/link';

const DEFAULT_LOW_STOCK_THRESHOLD_IN_BASE_UNITS = 5; // Assuming this default is in base units

interface LowStockWidgetProps {
  products: Product[];
}

export function LowStockWidget({ products }: LowStockWidgetProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const lowStockInfo = useMemo(() => {
    const lowStockProducts = products.filter(product => {
      // product.reorderThreshold is already in base units
      // product.quantityInStock is already in base units
      const threshold = product.reorderThreshold !== undefined && product.reorderThreshold > 0
                        ? product.reorderThreshold
                        : DEFAULT_LOW_STOCK_THRESHOLD_IN_BASE_UNITS;
      return product.quantityInStock < threshold;
    });
    return {
      count: lowStockProducts.length,
      items: lowStockProducts,
    };
  }, [products]);

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <div className="hover:shadow-md transition-shadow duration-200 rounded-lg block hover:cursor-pointer" onClick={() => lowStockInfo.count > 0 && setIsDialogOpen(true)}>
            <Card className={`${lowStockInfo.count === 0 ? 'cursor-default' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockInfo.count.toLocaleString('en-IN')}</div>
              </CardContent>
            </Card>
          </div>
        </DialogTrigger>
        {lowStockInfo.count > 0 && (
          <DialogContent className="sm:max-w-md md:max-w-lg">
            <DialogHeader>
              <DialogTitle>Low Stock Items ({lowStockInfo.count})</DialogTitle>
              <DialogDescription>
                These products are running low on stock (in their base units) and may need reordering soon.
              </DialogDescription>
            </DialogHeader>
            {lowStockInfo.items.length > 0 ? (
              <div className="max-h-[60vh] overflow-y-auto py-4 space-y-3 pr-2">
                {lowStockInfo.items.map(product => (
                  <div key={product.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-semibold">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Current Stock: {product.quantityInStock} {product.baseUnit}
                        {product.reorderThreshold && product.reorderThreshold > 0 
                          ? ` (Threshold: ${product.reorderThreshold} ${product.baseUnit})` 
                          : ` (Default Threshold: ${DEFAULT_LOW_STOCK_THRESHOLD_IN_BASE_UNITS} ${product.baseUnit})`}
                      </p>
                      {product.baseUnit !== product.purchaseUnit && product.purchaseUnitConversionFactor > 0 &&
                        <p className="text-xs text-muted-foreground">
                          Approx. { (product.quantityInStock / product.purchaseUnitConversionFactor).toFixed(1) } {product.purchaseUnit}s
                        </p>
                      }
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/products/${product.id}/edit`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-muted-foreground">No items are currently low on stock.</p>
            )}
            <DialogFooter className="sm:justify-start">
              <Button onClick={() => setIsDialogOpen(false)} variant="outline">Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
