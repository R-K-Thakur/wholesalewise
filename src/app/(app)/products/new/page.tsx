import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PRODUCT_UNITS } from "@/lib/constants";

// Placeholder for ProductForm component
function ProductFormPlaceholder() {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="productName" className="block text-sm font-medium text-foreground">Product Name</label>
        <input type="text" id="productName" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., Lavender Bliss Soap" />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-foreground">Category</label>
        <select id="category" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background">
          <option>Makeup</option>
          <option>Hair Oils</option>
          <option>Kitchen Utensils</option>
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="purchasePrice" className="block text-sm font-medium text-foreground">Purchase Price (₹)</label>
          <input type="number" id="purchasePrice" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 350.00" />
        </div>
        <div>
          <label htmlFor="retailPrice" className="block text-sm font-medium text-foreground">Retail Price (₹)</label>
          <input type="number" id="retailPrice" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 700.00" />
        </div>
      </div>
       <div>
        <label htmlFor="wholesalePrice" className="block text-sm font-medium text-foreground">Wholesale Price (₹)</label>
        <input type="number" id="wholesalePrice" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 525.00" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="block text-sm font-medium text-foreground mb-1">Unit</Label>
          <RadioGroup defaultValue={PRODUCT_UNITS[0]} className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {PRODUCT_UNITS.map((unit) => (
              <div key={unit} className="flex items-center space-x-2">
                <RadioGroupItem value={unit} id={`unit-${unit}`} />
                <Label htmlFor={`unit-${unit}`} className="font-normal">{unit}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div>
          <label htmlFor="initialStock" className="block text-sm font-medium text-foreground">Initial Stock Quantity</label>
          <input type="number" id="initialStock" className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" placeholder="e.g., 100" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/products">Cancel</Link>
        </Button>
        <Button type="submit">Save Product</Button>
      </div>
    </div>
  );
}


export default function NewProductPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Products</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Add New Product</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Fill in the information for the new product.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace with actual ProductForm component using react-hook-form and server actions */}
          <ProductFormPlaceholder />
        </CardContent>
      </Card>
    </div>
  );
}
