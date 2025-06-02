
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { addProduct, productFormSchema, type ValidatedProductFormData } from "./actions";

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<ValidatedProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      productName: "",
      // category: undefined, // Let placeholder in Select handle this
      purchasePrice: undefined,
      retailPrice: undefined,
      wholesalePrice: undefined,
      unit: PRODUCT_UNITS[0], // Default to the first unit
      initialStock: undefined,
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(data: ValidatedProductFormData) {
    try {
      const result = await addProduct(data);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        form.reset(); 
        // Optionally redirect: router.push('/products');
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
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 350.00" step="0.01" {...field} />
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
                        <Input type="number" placeholder="e.g., 700.00" step="0.01" {...field} />
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
                      <Input type="number" placeholder="e.g., 525.00" step="0.01" {...field} />
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
                          defaultValue={field.value}
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
                  name="initialStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" step="1" {...field} />
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
