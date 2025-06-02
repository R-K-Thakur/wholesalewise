import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder for SaleForm component
function SaleFormPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="saleType" className="block text-sm font-medium text-foreground">Sale Type</label>
        <select id="saleType" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background">
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </select>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">Items</h3>
        {/* Single item entry for placeholder */}
        <div className="p-4 border border-border rounded-md space-y-3">
          <div>
            <label htmlFor="product1" className="block text-sm font-medium text-foreground">Product</label>
            <select id="product1" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background">
              <option>Select a product...</option>
              <option>Lavender Lipstick</option>
              <option>Teal Hair Oil</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quantity1" className="block text-sm font-medium text-foreground">Quantity Sold</label>
              <input type="number" id="quantity1" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 2" />
            </div>
            <div>
              <label htmlFor="pricePerUnit1" className="block text-sm font-medium text-foreground">Price per Unit (₹)</label>
              <input type="number" id="pricePerUnit1" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 700.00" />
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
        <label htmlFor="customerName" className="block text-sm font-medium text-foreground">Customer Name (Optional)</label>
        <input type="text" id="customerName" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., John Doe" />
      </div>
      <div>
        <label htmlFor="saleDate" className="block text-sm font-medium text-foreground">Sale Date</label>
        <input type="date" id="saleDate" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
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
          {/* TODO: Replace with actual SaleForm component using react-hook-form and server actions */}
          <SaleFormPlaceholder />
        </CardContent>
      </Card>
    </div>
  );
}
