
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, UserCircle, CalendarDays } from "lucide-react"; // Added icons
import * as React from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { getProductByIdAction, updateProductAction } from "../../actions";
import { productFormSchema, type ValidatedProductFormData } from "../../schema";
import type { Product } from '@/lib/types'; // Import Product for type hints

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { toast } = useToast();
  const [isLoadingProduct, setIsLoadingProduct] = React.useState(true);
  const [productNotFound, setProductNotFound] = React.useState(false);
  const [productName, setProductName] = React.useState("Product");
  const [productDetails, setProductDetails] = React.useState<Product | null>(null);


  const form = useForm<ValidatedProductFormData>({
    resolver: zodResolver(productFormSchema),
  });

  const watchedBaseUnit = useWatch({ control: form.control, name: "baseUnit" });
  const watchedPurchaseUnit = useWatch({ control: form.control, name: "purchaseUnit" });
  
  const showConversionFactorInput = React.useMemo(() => {
    if (watchedBaseUnit === watchedPurchaseUnit) return false;
    if (watchedPurchaseUnit === "dozen" && watchedBaseUnit === "piece") return false;
    return true;
  }, [watchedBaseUnit, watchedPurchaseUnit]);

  React.useEffect(() => {
    if (watchedPurchaseUnit === "dozen" && watchedBaseUnit === "piece") {
      form.setValue("purchaseUnitConversionFactor", 12, { shouldValidate: true });
    } else if (watchedBaseUnit === watchedPurchaseUnit) {
      const currentFactor = form.getValues("purchaseUnitConversionFactor");
      if (currentFactor !== 1) {
        form.setValue("purchaseUnitConversionFactor", 1, { shouldValidate: true });
      }
    }
  }, [watchedBaseUnit, watchedPurchaseUnit, form]);


  React.useEffect(() => {
    if (productId) {
      setIsLoadingProduct(true);
      getProductByIdAction(productId)
        .then(product => {
          if (product) {
            setProductName(product.name);
            setProductDetails(product); // Store full product details
            let conversionFactor = product.purchaseUnitConversionFactor;
            if (product.purchaseUnit === "dozen" && product.baseUnit === "piece") {
              conversionFactor = 12;
            } else if (product.baseUnit === product.purchaseUnit) {
              conversionFactor = 1;
            }

            form.reset({
              productName: product.name,
              category: product.category,
              baseUnit: product.baseUnit,
              purchaseUnit: product.purchaseUnit,
              purchaseUnitConversionFactor: conversionFactor,
              purchasePrice: product.purchasePrice,
              retailPricePerBaseUnit: product.retailPricePerBaseUnit,
              wholesalePricePerBaseUnit: product.wholesalePricePerBaseUnit,
              initialStock: product.quantityInStock, 
              reorderThreshold: product.reorderThreshold ?? 0,
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
    let formData = {...data};
    
    if (formData.baseUnit === formData.purchaseUnit) {
      formData.purchaseUnitConversionFactor = 1;
    } else if (formData.purchaseUnit === "dozen" && formData.baseUnit === "piece") {
      formData.purchaseUnitConversionFactor = 12;
    }
    
    if (formData.baseUnit !== formData.purchaseUnit && 
        !(formData.purchaseUnit === "dozen" && formData.baseUnit === "piece") &&
        (!formData.purchaseUnitConversionFactor || formData.purchaseUnitConversionFactor < 1) ) {
        toast({ title: "Error", description: "A valid conversion factor (>0) is required if units differ and are not dozen/piece.", variant: "destructive" });
        form.setError("purchaseUnitConversionFactor", { type: "manual", message: "Conversion factor is required and must be > 0."});
        return;
    }

    try {
      const result = await updateProductAction(productId, formData);
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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Product: {productName}</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Edit Product Details</CardTitle>
          <CardDescription>Modify the information for product: {productName}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Product Info Fields Here... */}
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
                  name="purchaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Unit (Bought As)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select purchase unit..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PRODUCT_UNITS.map(unit => (<SelectItem key={`purchase-${unit}`} value={unit}>{unit}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="baseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Unit (Smallest Sellable)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select base unit..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PRODUCT_UNITS.map(unit => (<SelectItem key={`base-${unit}`} value={unit}>{unit}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {showConversionFactorInput && (
                <FormField
                  control={form.control}
                  name="purchaseUnitConversionFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversion Factor ({watchedBaseUnit}s per {watchedPurchaseUnit})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 12" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(watchedPurchaseUnit === "dozen" && watchedBaseUnit === "piece") && (
                <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">
                  Automatic conversion: 1 dozen = 12 pieces. Factor is set to 12.
                </div>
              )}

              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price (₹ per {watchedPurchaseUnit || 'Purchase Unit'})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 350.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="retailPricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price (₹ per {watchedBaseUnit || 'Base Unit'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wholesalePricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale Price (₹ per {watchedBaseUnit || 'Base Unit'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 40.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="initialStock" 
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock (in {watchedBaseUnit || 'Base Units'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="reorderThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Threshold (in {watchedBaseUnit || 'Base Units'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 24" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
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
          
          {productDetails && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-base font-medium mb-3 text-foreground">Product History</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {productDetails.createdByEmail && (
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Created by: {productDetails.createdByEmail}</span>
                    <CalendarDays className="h-4 w-4 ml-auto" />
                    <span>{format(new Date(productDetails.createdAt), "PPp")}</span>
                  </div>
                )}
                {productDetails.lastStockUpdateByEmail && productDetails.lastStockUpdateByEmail !== productDetails.createdByEmail && (
                   <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Last stock updated by: {productDetails.lastStockUpdateByEmail}</span>
                    <CalendarDays className="h-4 w-4 ml-auto" />
                    <span>{format(new Date(productDetails.updatedAt), "PPp")}</span>
                  </div>
                )}
                 {productDetails.lastStockUpdateByEmail && productDetails.lastStockUpdateByEmail === productDetails.createdByEmail && productDetails.updatedAt !== productDetails.createdAt && (
                   <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Stock updated by: {productDetails.lastStockUpdateByEmail}</span>
                    <CalendarDays className="h-4 w-4 ml-auto" />
                    <span>{format(new Date(productDetails.updatedAt), "PPp")}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

