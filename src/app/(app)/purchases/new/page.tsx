import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Placeholder for PurchaseForm component
function PurchaseFormPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="product" className="block text-sm font-medium text-foreground">Product</label>
        <select id="product" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background">
          <option>Select a product...</option>
          <option>Lavender Lipstick</option>
          <option>Teal Hair Oil</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="quantityPurchased" className="block text-sm font-medium text-foreground">Quantity Purchased</label>
          <input type="number" id="quantityPurchased" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 50" />
        </div>
        <div>
          <label htmlFor="purchasePricePerUnit" className="block text-sm font-medium text-foreground">Purchase Price per Unit (₹)</label>
          <input type="number" id="purchasePricePerUnit" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 350.00" />
        </div>
      </div>
      <div>
        <label htmlFor="vendor" className="block text-sm font-medium text-foreground">Vendor (Optional)</label>
        <input type="text" id="vendor" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., Beauty Supplies Inc." />
      </div>
      <div>
        <label htmlFor="purchaseDate" className="block text-sm font-medium text-foreground">Purchase Date</label>
        <input type="date" id="purchaseDate" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/purchases">Cancel</Link>
        </Button>
        <Button type="submit">Record Purchase</Button>
      </div>
    </div>
  );
}

export default function NewPurchasePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/purchases">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Purchases</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Record New Purchase</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Purchase Details</CardTitle>
          <CardDescription>Enter the details of the stock purchase.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace with actual PurchaseForm component using react-hook-form and server actions */}
          <PurchaseFormPlaceholder />
        </CardContent>
      </Card>
    </div>
  );
}
