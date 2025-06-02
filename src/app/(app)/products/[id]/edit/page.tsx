
"use client"; // Required for using useParams and potentially form state later

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft } from "lucide-react";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants"; // Assuming PRODUCT_CATEGORIES is also needed
import type { ProductCategory, ProductUnit } from '@/lib/constants';

// Mock data for product to edit - replace with actual data fetching
const mockProductData: Record<string, ProductEditData> = {
  "1": { id: "1", name: "Lavender Lipstick", category: "Makeup", purchasePrice: 350.00, retailPrice: 999.00, wholesalePrice: 500.00, unit: "piece", initialStock: 150 },
  "2": { id: "2", name: "Teal Hair Oil", category: "Hair Oils", purchasePrice: 280.00, retailPrice: 650.00, wholesalePrice: 400.00, unit: "piece", initialStock: 80 },
  "3": { id: "3", name: "Silver Earrings", category: "Imitation Jewellery", purchasePrice: 1200.00, retailPrice: 1999.00, wholesalePrice: 1500.00, unit: "set", initialStock: 200 },
};

interface ProductEditData {
  id: string;
  name: string;
  category: ProductCategory;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  unit: ProductUnit;
  initialStock: number; // Or current stock if editing
}

// Placeholder for ProductForm component, adapted for editing
// In a real app, this would be a proper form component with react-hook-form
function EditProductFormPlaceholder({ product }: { product: ProductEditData }) {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="productName" className="block text-sm font-medium text-foreground">Product Name</label>
        <input type="text" id="productName" defaultValue={product.name} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-foreground">Category</label>
        <select id="category" defaultValue={product.category} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background">
          {PRODUCT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="purchasePrice" className="block text-sm font-medium text-foreground">Purchase Price (₹)</label>
          <input type="number" id="purchasePrice" defaultValue={product.purchasePrice} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
        </div>
        <div>
          <label htmlFor="retailPrice" className="block text-sm font-medium text-foreground">Retail Price (₹)</label>
          <input type="number" id="retailPrice" defaultValue={product.retailPrice} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
        </div>
      </div>
       <div>
        <label htmlFor="wholesalePrice" className="block text-sm font-medium text-foreground">Wholesale Price (₹)</label>
        <input type="number" id="wholesalePrice" defaultValue={product.wholesalePrice} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="block text-sm font-medium text-foreground mb-1">Unit</Label>
          <RadioGroup defaultValue={product.unit} className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
            {PRODUCT_UNITS.map((unit) => (
              <div key={unit} className="flex items-center space-x-2">
                <RadioGroupItem value={unit} id={`unit-${unit}`} />
                <Label htmlFor={`unit-${unit}`} className="font-normal">{unit}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div>
          <label htmlFor="initialStock" className="block text-sm font-medium text-foreground">Stock Quantity</label>
          <input type="number" id="initialStock" defaultValue={product.initialStock} className="mt-1 block w-full rounded-md border-input shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 bg-background" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/products">Cancel</Link>
        </Button>
        {/* TODO: Implement actual save logic */}
        <Button type="submit">Save Changes</Button>
      </div>
    </div>
  );
}


export default function EditProductPage() {
  const params = useParams();
  const productId = params.id as string;

  // In a real app, you would fetch product details based on productId
  const product = mockProductData[productId]; // Using mock data

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-xl text-muted-foreground">Product not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/products">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Products</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Product: {product.name}</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Edit Product Details</CardTitle>
          <CardDescription>Modify the information for product: {product.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Replace with actual ProductForm component using react-hook-form and server actions */}
          <EditProductFormPlaceholder product={product} />
        </CardContent>
      </Card>
    </div>
  );
}
