
"use client"; // For better form interactivity

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PRODUCT_UNITS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { Input } from "@/components/ui/input"; // Import Input component
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select components
import type { FormEvent } from 'react';

// Placeholder for ProductForm component
function ProductFormPlaceholder() {
  // In a real app, this would use react-hook-form and state
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // TODO: Implement actual form submission logic (e.g., using Server Actions)
    console.log("Form submitted. Implement save logic here.");
    // For example, you might get form data like this:
    // const formData = new FormData(event.currentTarget);
    // const productData = Object.fromEntries(formData.entries());
    // console.log("Product Data:", productData);
    alert("Product save functionality not yet implemented. Check console for data.");
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="productName" className="block text-sm font-medium text-foreground">Product Name</Label>
        <Input 
          type="text" 
          id="productName" 
          name="productName"
          className="mt-1" 
          placeholder="e.g., Lavender Bliss Soap" 
          required
        />
      </div>
      <div>
        <Label htmlFor="category" className="block text-sm font-medium text-foreground">Category</Label>
        <Select name="category" required>
          <SelectTrigger id="category" className="mt-1 w-full">
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_CATEGORIES.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="purchasePrice" className="block text-sm font-medium text-foreground">Purchase Price (₹)</Label>
          <Input 
            type="number" 
            id="purchasePrice" 
            name="purchasePrice"
            className="mt-1" 
            placeholder="e.g., 350.00" 
            step="0.01"
            required
          />
        </div>
        <div>
          <Label htmlFor="retailPrice" className="block text-sm font-medium text-foreground">Retail Price (₹)</Label>
          <Input 
            type="number" 
            id="retailPrice" 
            name="retailPrice"
            className="mt-1" 
            placeholder="e.g., 700.00" 
            step="0.01"
            required
          />
        </div>
      </div>
       <div>
        <Label htmlFor="wholesalePrice" className="block text-sm font-medium text-foreground">Wholesale Price (₹)</Label>
        <Input 
          type="number" 
          id="wholesalePrice" 
          name="wholesalePrice"
          className="mt-1" 
          placeholder="e.g., 525.00" 
          step="0.01"
          required
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="block text-sm font-medium text-foreground mb-1">Unit</Label>
          <RadioGroup defaultValue={PRODUCT_UNITS[0]} name="unit" className="mt-1 flex flex-wrap gap-x-4 gap-y-2" required>
            {PRODUCT_UNITS.map((unit) => (
              <div key={unit} className="flex items-center space-x-2">
                <RadioGroupItem value={unit} id={`unit-${unit}`} />
                <Label htmlFor={`unit-${unit}`} className="font-normal">{unit}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="initialStock" className="block text-sm font-medium text-foreground">Initial Stock Quantity</Label>
          <Input 
            type="number" 
            id="initialStock" 
            name="initialStock"
            className="mt-1" 
            placeholder="e.g., 100" 
            step="1"
            required
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/products">Cancel</Link>
        </Button>
        <Button type="submit">Save Product</Button>
      </div>
    </form>
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
          <ProductFormPlaceholder />
        </CardContent>
      </Card>
    </div>
  );
}
