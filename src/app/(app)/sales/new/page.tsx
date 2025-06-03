
"use client"; // Main page can be client, but SaleFormPlaceholder will get data via props

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, PlusCircle, Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types"; // Import Product type
import { getProductsAction } from "../../products/actions"; // Import action to get products


// Placeholder for SaleForm component - now accepts products prop
function SaleFormPlaceholder({ products }: { products: Product[] }) {
  const [comboboxOpen, setComboboxOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState("");

  // TODO: Implement actual form logic with react-hook-form, item management, etc.

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="saleType">Sale Type</Label>
        <select id="saleType" className="mt-1 block w-full rounded-md border-input bg-background shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2">
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Items</h3>
        {/* Single item entry for placeholder */}
        <div className="p-4 border border-border rounded-md space-y-3">
          <div>
            <Label htmlFor="product1">Product</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between mt-1"
                >
                  {selectedProduct
                    ? products.find((product) => product.name.toLowerCase() === selectedProduct)?.name
                    : "Select a product..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandEmpty>No product found.</CommandEmpty>
                  <CommandGroup>
                    <CommandList>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.name.toLowerCase()}
                          onSelect={(currentValue) => {
                            setSelectedProduct(currentValue === selectedProduct ? "" : currentValue);
                            setComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProduct === product.name.toLowerCase() ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {product.name} (Stock: {product.quantityInStock})
                        </CommandItem>
                      ))}
                    </CommandList>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity1">Quantity Sold</Label>
              <Input type="number" id="quantity1" className="mt-1" placeholder="e.g., 2" />
            </div>
            <div>
              <Label htmlFor="pricePerUnit1">Price per Unit (₹)</Label>
              <Input type="number" id="pricePerUnit1" className="mt-1" placeholder="e.g., 700.00" />
            </div>
          </div>
          <div className="flex justify-end">
             <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-1" /> Remove Item
            </Button>
          </div>
        </div>
        <Button variant="outline" className="w-full">
          <PlusCircle className="h-4 w-4 mr-2" /> Add Another Item
        </Button>
      </div>
      
      <div>
        <Label htmlFor="customerName">Customer Name (Optional)</Label>
        <Input type="text" id="customerName" className="mt-1" placeholder="e.g., John Doe" />
      </div>
      <div>
        <Label htmlFor="saleDate">Sale Date</Label>
        <Input type="date" id="saleDate" className="mt-1" defaultValue={new Date().toISOString().split('T')[0]} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/sales">Cancel</Link>
        </Button>
        <Button type="submit">Record Sale</Button>
      </div>
    </div>
  );
}


export default function NewSalePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchProductsData() {
      setIsLoading(true);
      try {
        const fetchedProducts = await getProductsAction();
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Failed to fetch products for new sale page:", error);
        // Optionally, set an error state and display a message to the user
      } finally {
        setIsLoading(false);
      }
    }
    fetchProductsData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/sales">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Sales</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Record New Sale</h1>
      </div>
      
      <Card className="max-w-3xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Sale Transaction Details</CardTitle>
          <CardDescription>Enter the details for the new sale.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading products...</p>
            </div>
          ) : (
            <SaleFormPlaceholder products={products} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
