
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { addProduct } from "../actions";
import { productFormSchema, type ValidatedProductFormData } from "../schema";

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ValidatedProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      productName: "",
      baseUnit: PRODUCT_UNITS[0],
      purchaseUnit: PRODUCT_UNITS[0],
      purchaseUnitConversionFactor: 1,
      purchasePrice: '' as unknown as number, 
      retailPricePerBaseUnit: '' as unknown as number, 
      wholesalePricePerBaseUnit: '' as unknown as number,
      initialStock: '' as unknown as number, 
      reorderThreshold: 0,
    },
  });

  const { isSubmitting } = form.formState;
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
      form.setValue("purchaseUnitConversionFactor", 1, { shouldValidate: true });
    }
  }, [watchedBaseUnit, watchedPurchaseUnit, form]);


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
      const result = await addProduct(formData);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        form.reset(); 
        router.push('/products');
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add product.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to add product:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
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
        <h1 className="text-3xl font-bold tracking-tight font-headline">Add New Product</h1>
      </div>
      
      <Card className="max-w-2xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Fill in the information for the new product.</CardDescription>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormLabel>Purchase Price (Rs. per {watchedPurchaseUnit || 'Purchase Unit'})</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 350.00" step="0.01" {...field} onChange={e => field.onChange(e.target.value)}/>
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
                      <FormLabel>Retail Price (Rs. per {watchedBaseUnit || 'Base Unit'}) (Optional)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50.00" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} />
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
                        <Input type="number" placeholder="e.g., 40.00" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} />
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
                      <FormLabel>Initial Stock (in {watchedPurchaseUnit || 'Purchase Units'})</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} />
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
                      <FormLabel>Reorder Threshold (in {watchedBaseUnit || 'Base Units'}) (Optional)</FormLabel>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Product
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

