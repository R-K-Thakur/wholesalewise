
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
import { getProductsAction } from "../../products/actions";
import { useToast } from "@/hooks/use-toast";
import { saleFormSchema, type SaleFormData, type SaleItemFormData, type RecordSaleActionPayload } from "../schema";
import { recordSaleAction } from "../actions";
import type { ProductUnit } from "@/lib/constants";


// SaleForm component that uses react-hook-form
function SaleForm({ allProducts }: { allProducts: Product[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      saleType: 'retail',
      saleDate: new Date().toISOString().split('T')[0],
      items: [{ productId: '', quantitySold: 1, pricePerUnitSold: 0 }],
      paymentMethod: 'cash',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchSaleType = form.watch("saleType");
  const watchItems = form.watch("items");

  async function onSubmit(data: SaleFormData) {
    form.clearErrors(); // Clear previous errors
    let totalAmount = 0;
    const itemsForAction: RecordSaleActionPayload['items'] = [];

    for (const item of data.items) {
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) {
        // This should ideally be caught by form validation, but as a fallback
        toast({ title: "Error", description: `Product details not found for one of the items.`, variant: "destructive"});
        return;
      }
      const itemTotal = (item.quantitySold || 0) * (item.pricePerUnitSold || 0);
      totalAmount += itemTotal;
      itemsForAction.push({
        ...item,
        productNameSnapshot: product.name,
        unitSnapshot: product.unit,
        total: itemTotal,
      });
    }
    
    const payload: RecordSaleActionPayload = {
      ...data,
      items: itemsForAction,
      totalAmount,
    };

    try {
      const result = await recordSaleAction(payload);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        form.reset(); 
        router.push('/sales'); 
      } else {
        toast({
          title: "Error Recording Sale",
          description: result.message || "Failed to record sale.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to record sale:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while recording the sale. Please try again.",
        variant: "destructive",
      });
    }
  }

  const handleProductSelect = (itemIndex: number, productId: string) => {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${itemIndex}.productId`, product.id);
      // productNameSnapshot and unitSnapshot will be added during onSubmit
      const price = watchSaleType === 'wholesale' ? product.wholesalePrice : product.retailPrice;
      form.setValue(`items.${itemIndex}.pricePerUnitSold`, price);
      form.trigger(`items.${itemIndex}.pricePerUnitSold`); // Trigger validation for price
      form.clearErrors(`items.${itemIndex}.productId`); 
    }
  };
  
  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);

  const calculateGrandTotal = () => {
    return watchItems.reduce((sum, item) => {
      const quantity = Number(item.quantitySold) || 0;
      const price = Number(item.pricePerUnitSold) || 0;
      return sum + (quantity * price);
    }, 0);
  };


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="saleType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Type</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Update prices when sale type changes
                    watchItems.forEach((item, index) => {
                      const product = allProducts.find(p => p.id === item.productId);
                      if (product) {
                        const newPrice = value === 'wholesale' ? product.wholesalePrice : product.retailPrice;
                        form.setValue(`items.${index}.pricePerUnitSold`, newPrice);
                      }
                    });
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select sale type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="saleDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Name (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., John Doe" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div>
          <h3 className="text-lg font-medium text-foreground mb-2">Items</h3>
          {fields.map((item, index) => (
            <Card key={item.id} className="mb-4 p-4 space-y-3 bg-card/50 dark:bg-card/80">
              <FormField
                control={form.control}
                name={`items.${index}.productId`}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover open={openComboboxIndex === index} onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? allProducts.find(
                                  (p) => p.id === field.value
                                )?.name
                              : "Select a product..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search product..." />
                          <CommandList>
                            <CommandEmpty>No product found.</CommandEmpty>
                            <CommandGroup>
                              {allProducts.map((product) => (
                                <CommandItem
                                  value={product.name}
                                  key={product.id}
                                  onSelect={() => {
                                    handleProductSelect(index, product.id);
                                    setOpenComboboxIndex(null);
                                  }}
                                  disabled={product.quantityInStock === 0}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      product.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {product.name} (Stock: {product.quantityInStock} {product.unit})
                                  {product.quantityInStock === 0 && <span className="ml-auto text-xs text-destructive">Out of Stock</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name={`items.${index}.quantitySold`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.pricePerUnitSold`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price/Unit (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 700.00" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="flex flex-col justify-end">
                    <FormLabel>Item Total (₹)</FormLabel>
                    <Input 
                        type="text" 
                        readOnly 
                        disabled 
                        value={((Number(watchItems[index]?.quantitySold) || 0) * (Number(watchItems[index]?.pricePerUnitSold) || 0)).toFixed(2)}
                        className="bg-muted/50"
                    />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => fields.length > 1 ? remove(index) : toast({ title: "Cannot remove last item", description: "A sale must have at least one item.", variant: "destructive"})}
                  disabled={fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove Item
                </Button>
              </div>
            </Card>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full mt-2"
            onClick={() => append({ productId: '', quantitySold: 1, pricePerUnitSold: 0 } as SaleItemFormData)}
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Add Another Item
          </Button>
           <FormMessage>{form.formState.errors.items?.root?.message || form.formState.errors.items?.message}</FormMessage>
        </div>

        <div className="mt-6 pt-4 border-t">
            <p className="text-xl font-semibold text-right">
                Grand Total: ₹{calculateGrandTotal().toFixed(2)}
            </p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" asChild disabled={form.formState.isSubmitting}>
            <Link href="/sales">Cancel</Link>
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting || allProducts.length === 0}>
            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Sale
          </Button>
        </div>
      </form>
    </Form>
  );
}


export default function NewSalePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProductsData() {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedProducts = await getProductsAction();
        setProducts(fetchedProducts);
      } catch (e) {
        console.error("Failed to fetch products for new sale page:", e);
        setError(e instanceof Error ? e.message : "Failed to load products.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchProductsData();
  }, []);

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
          <CardDescription>Enter the details for the new sale. Select products and specify quantities and prices.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground mt-2">Loading products...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
               <p>{error}</p>
               <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">Try Again</Button>
            </div>
          ) : ( // Removed check for products.length === 0 here as SaleForm will handle it or be disabled
            <SaleForm allProducts={products} />
          )}
           { !isLoading && !error && products.length === 0 && (
             <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
               <p>No products found. Please add products first to record a sale.</p>
               <Button variant="default" asChild className="mt-4">
                 <Link href="/products/new">Add Product</Link>
               </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
