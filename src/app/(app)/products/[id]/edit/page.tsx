
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { getProductByIdAction, updateProductAction } from "../../actions";
import { productFormSchema, type ValidatedProductFormData } from "../../schema";
import type { Product } from '@/lib/types';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { toast } = useToast();
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [productNotFound, setProductNotFound] = useState(false);

  const form = useForm<ValidatedProductFormData>({
    resolver: zodResolver(productFormSchema),
    // Default values will be set by useEffect after fetching product
  });

  useEffect(() => {
    if (productId) {
      setIsLoadingProduct(true);
      getProductByIdAction(productId)
        .then(product => {
          if (product) {
            // Map Product fields to ValidatedProductFormData fields
            form.reset({
              productName: product.name,
              category: product.category,
              purchasePrice: product.purchasePrice,
              retailPrice: product.retailPrice,
              wholesalePrice: product.wholesalePrice,
              unit: product.unit,
              initialStock: product.quantityInStock, // 'initialStock' here refers to current stock for editing
            });
            setProductNotFound(false);
          } else {
            setProductNotFound(true);
            toast({
              title: "Error",
              description: "Product not found.",
              variant: "destructive",
            });
          }
        })
        .catch(error => {
          console.error("Failed to fetch product:", error);
          toast({
            title: "Error",
            description: "Failed to load product details.",
            variant: "destructive",
          });
          setProductNotFound(true);
        })
        .finally(() => {
          setIsLoadingProduct(false);
        });
    }
  }, [productId, form, toast]);

  const { isSubmitting } = form.formState;

  async function onSubmit(data: ValidatedProductFormData) {
    try {
      const result = await updateProductAction(productId, data);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.push('/products');
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update product.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to update product:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  }

  if (isLoadingProduct) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading product details...</p>
      </div>
    );
  }

  if (productNotFound) {
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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Product: {form.getValues('productName')}</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Edit Product Details</CardTitle>
          <CardDescription>Modify the information for product: {form.getValues('productName')}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Lavender Bliss Soap" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 350.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retailPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 700.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="wholesalePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wholesale Price (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 525.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-wrap gap-x-4 gap-y-2"
                        >
                          {PRODUCT_UNITS.map((unit) => (
                            <FormItem key={unit} className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={unit} />
                              </FormControl>
                              <FormLabel className="font-normal">{unit}</FormLabel>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="initialStock" // This field name is from schema, maps to quantityInStock for edit
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" asChild disabled={isSubmitting}>
                  <Link href="/products">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoadingProduct}>
                  {(isSubmitting || isLoadingProduct) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
