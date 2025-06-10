
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, UserCircle, CalendarDays, ShieldAlert, Edit3 } from "lucide-react";
import * as React from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { getProductByIdAction, updateProductAction } from "../../actions";
import { productFormSchema, type ValidatedProductFormData } from "../../schema";
import type { Product } from '@/lib/types';
import { getSession, type SessionData } from "@/app/login/actions";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { toast } = useToast();

  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [userRole, setUserRole] = useState<SessionData['role'] | undefined>(undefined);

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
    async function fetchInitialData() {
      setIsLoadingSession(true);
      setIsLoadingProduct(true);
      
      const currentSession = await getSession();
      setSession(currentSession);
      setUserRole(currentSession?.role);
      setIsLoadingSession(false);

      if (productId) {
        try {
          const product = await getProductByIdAction(productId);
          if (product) {
            setProductName(product.name);
            setProductDetails(product);
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
              initialStock: product.quantityInStock, // This is current stock on edit form
              reorderThreshold: product.reorderThreshold ?? 0,
            });
            setProductNotFound(false);
          } else {
            setProductNotFound(true);
            toast({ title: "Error", description: "Product not found.", variant: "destructive" });
          }
        } catch (error) {
          console.error("Failed to fetch product:", error);
          toast({ title: "Error", description: "Failed to load product details.", variant: "destructive" });
          setProductNotFound(true);
        } finally {
          setIsLoadingProduct(false);
        }
      } else {
        setIsLoadingProduct(false);
        setProductNotFound(true); // No ID, no product
      }
    }
    fetchInitialData();
  }, [productId, form, toast]);


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
    
    // If staff is editing, and the purchase price field was hidden,
    // ensure the original purchase price is sent, not a potentially empty/default one from the form state.
    if (userRole === 'staff' && productDetails) {
        formData.purchasePrice = productDetails.purchasePrice;
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

  const canEditStock = userRole === 'owner';
  const canEditPurchasePrice = userRole === 'owner';

  if (isLoadingProduct || isLoadingSession) {
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
              
              {canEditPurchasePrice ? (
                <FormField
                  control={form.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (Rs. per {watchedPurchaseUnit || 'Purchase Unit'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 350.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                productDetails && (productDetails.purchasePrice === undefined || productDetails.purchasePrice <= 0) && (
                  <div className="space-y-1">
                    <FormLabel>Purchase Price</FormLabel>
                    <div className="p-3 border rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>Purchase price needs to be set by an owner.</span>
                      </div>
                    </div>
                  </div>
                )
                // If staff and price > 0, the field is simply not rendered.
              )}


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="retailPricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price (Rs. per {watchedBaseUnit || 'Base Unit'})</FormLabel>
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
                      <FormLabel>Wholesale Price (Rs. per {watchedBaseUnit || 'Base Unit'})</FormLabel>
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
                  name="initialStock" // This field on edit form represents CURRENT stock
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Stock (in {watchedBaseUnit || 'Base Units'})</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="e.g., 100" 
                          step="1" 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} 
                          disabled={!canEditStock && userRole === 'staff'} // Disable for staff if they can't edit stock here
                        />
                      </FormControl>
                      {!canEditStock && userRole === 'staff' && (
                        <p className="text-xs text-muted-foreground">Staff can update stock via "Add Stock" on product list page.</p>
                      )}
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
                <Button type="submit" disabled={isSubmitting || isLoadingProduct || isLoadingSession}>
                  {(isSubmitting || isLoadingProduct || isLoadingSession) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        {productDetails && (
          <CardFooter className="pt-6 border-t mt-6">
            <div className="w-full space-y-2 text-sm text-muted-foreground">
              <h3 className="text-base font-medium text-foreground mb-2">Product History</h3>
              {(productDetails.createdByName || productDetails.createdByEmail) && (
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Created by: {productDetails.createdByName || productDetails.createdByEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{format(new Date(productDetails.createdAt), "PPp")}</span>
                  </div>
                </div>
              )}
              {(productDetails.lastStockUpdateByName || productDetails.lastStockUpdateByEmail) &&
                (productDetails.lastStockUpdateByEmail !== productDetails.createdByEmail || productDetails.lastStockUpdateByName !== productDetails.createdByName || productDetails.updatedAt !== productDetails.createdAt) && (
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>Last stock updated by: {productDetails.lastStockUpdateByName || productDetails.lastStockUpdateByEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{format(new Date(productDetails.updatedAt), "PPp")}</span>
                  </div>
                </div>
              )}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    