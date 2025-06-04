
"use client";

import * as React from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Check, ChevronsUpDown } from "lucide-react"; // Added Check, ChevronsUpDown

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox"; 
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput as ShadCNCommandInput, // Renamed to avoid conflict if used
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormDescription as ShadFormDescription, 
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
import { saleFormSchema, type SaleFormData, type RecordSaleActionPayload } from "../schema";
import { recordSaleAction } from "../actions";
import type { ProductUnit } from "@/lib/constants";


function SaleForm({ allProducts }: { allProducts: Product[] }) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      saleType: 'retail', 
      saleDate: new Date().toISOString().split('T')[0],
      items: [{ 
        productId: '', 
        quantitySold: 1, 
        pricePerUnitSold: 0,
        soldUnit: allProducts.length > 0 ? allProducts[0].baseUnit : 'piece',
        baseUnitSnapshot: allProducts.length > 0 ? allProducts[0].baseUnit : 'piece'
      }],
      paymentMethod: 'cash',
      customerName: '',
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const watchSaleType = form.watch("saleType");

  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);
  // itemSearchTexts will hold the text typed by the user in each product input field.
  const [itemSearchTexts, setItemSearchTexts] = React.useState<string[]>(
    // Initialize based on existing product names if any, or empty strings
    form.getValues("items").map(item => {
      if (item.productId) {
        const product = allProducts.find(p => p.id === item.productId);
        return product ? product.name : "";
      }
      return "";
    })
  );

  // Effect to update itemSearchTexts if items are added/removed or productIds change externally
  React.useEffect(() => {
    const currentFormItems = form.getValues("items");
    if (currentFormItems.length !== itemSearchTexts.length) {
      setItemSearchTexts(currentFormItems.map((item, idx) => {
          if (item.productId) {
            const product = allProducts.find(p => p.id === item.productId);
            return product ? product.name : (itemSearchTexts[idx] || '');
          }
          return itemSearchTexts[idx] || '';
        })
      );
    }
  }, [fields.length, form, allProducts]); // Watch fields.length for add/remove

  const handleAddItem = () => {
    append({ 
      productId: '', 
      quantitySold: 1, 
      pricePerUnitSold: 0, 
      soldUnit: allProducts.length > 0 ? allProducts[0].baseUnit : 'piece',
      baseUnitSnapshot: allProducts.length > 0 ? allProducts[0].baseUnit : 'piece'
    });
    setItemSearchTexts(prev => [...prev, ""]); // Add empty search text for the new item
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length <= 1) {
      toast({ title: "Cannot remove last item", description: "A sale must have at least one item.", variant: "destructive" });
      return;
    }
    remove(index);
    setItemSearchTexts(prev => prev.filter((_, i) => i !== index));
  };


  React.useEffect(() => {
    watchItems.forEach((item, index) => {
        const product = allProducts.find(p => p.id === item.productId);
        if (product) {
            const price = watchSaleType === 'wholesale' 
                ? product.wholesalePricePerBaseUnit 
                : product.retailPricePerBaseUnit;
            
            let pricePerSoldUnit = price;
            if (item.soldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor > 0) {
                pricePerSoldUnit = price * product.purchaseUnitConversionFactor;
            }
            
            if (form.getValues(`items.${index}.pricePerUnitSold`) !== pricePerSoldUnit) {
                 form.setValue(`items.${index}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)));
            }
        }
    });
  }, [watchSaleType, watchItems, allProducts, form]);


  async function onSubmit(data: SaleFormData) {
    form.clearErrors();
    let totalAmount = 0;
    const itemsForAction: RecordSaleActionPayload['items'] = [];
    let hasError = false;

    for (const [index, item] of data.items.entries()) {
      if (!item.productId) { // Check if a product was actually selected
        toast({ title: "Error", description: `Product not selected for item ${index + 1}. Please type and select a product from the list.`, variant: "destructive"});
        form.setError(`items.${index}.productId`, {message: "Product selection is required."});
        hasError = true;
        continue; 
      }
      const product = allProducts.find(p => p.id === item.productId);
      if (!product) {
        toast({ title: "Error", description: `Invalid product for item ${index + 1}.`, variant: "destructive"});
        form.setError(`items.${index}.productId`, {message: "Invalid product selected."});
        hasError = true;
        continue;
      }
      const itemTotal = (item.quantitySold || 0) * (item.pricePerUnitSold || 0);
      totalAmount += itemTotal;
      itemsForAction.push({
        ...item,
        productNameSnapshot: product.name, // Ensure productNameSnapshot is from the actual product
        total: itemTotal,
      });
    }
    
    if (hasError) return;

    const payload: RecordSaleActionPayload = {
      ...data,
      customerName: data.customerName || undefined,
      notes: data.notes || undefined,
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
        setItemSearchTexts(form.getValues("items").map(() => "")); // Reset search texts
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
  
  const handleProductSelectInternal = (itemIndex: number, productId: string) => {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${itemIndex}.productId`, product.id);
      form.setValue(`items.${itemIndex}.baseUnitSnapshot`, product.baseUnit);
      form.setValue(`items.${itemIndex}.soldUnit`, product.baseUnit); 
      
      const currentSaleType = form.getValues("saleType");
      const pricePerBaseUnit = currentSaleType === 'wholesale' 
          ? product.wholesalePricePerBaseUnit 
          : product.retailPricePerBaseUnit;

      form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerBaseUnit.toFixed(2)));
      form.trigger(`items.${itemIndex}.pricePerUnitSold`); 
      form.trigger(`items.${itemIndex}.soldUnit`);
      form.clearErrors(`items.${itemIndex}.productId`);

      // Update the search text to the selected product's name
      const newSearchTexts = [...itemSearchTexts];
      newSearchTexts[itemIndex] = product.name;
      setItemSearchTexts(newSearchTexts);
    }
  };
  
  const handleSoldUnitChange = (itemIndex: number, newSoldUnit: ProductUnit) => {
    form.setValue(`items.${itemIndex}.soldUnit`, newSoldUnit);
    const product = allProducts.find(p => p.id === form.getValues(`items.${itemIndex}.productId`));
    if (product) {
        const currentSaleType = form.getValues("saleType");
        const pricePerBaseUnit = currentSaleType === 'wholesale' 
            ? product.wholesalePricePerBaseUnit 
            : product.retailPricePerBaseUnit;
        
        let pricePerSoldUnit = pricePerBaseUnit;
        if (newSoldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor > 0) {
            pricePerSoldUnit = pricePerBaseUnit * product.purchaseUnitConversionFactor;
        }
        form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)));
    }
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <FormField
            control={form.control}
            name="saleType"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 h-full">
                <FormControl>
                  <Checkbox
                    checked={field.value === 'wholesale'}
                    onCheckedChange={(checked) => {
                      const newSaleType = checked ? 'wholesale' : 'retail';
                      field.onChange(newSaleType);
                    }}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Wholesale Sale
                  </FormLabel>
                  <ShadFormDescription>
                    Mark if this is a wholesale transaction. Prices adjust automatically.
                  </ShadFormDescription>
                </div>
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
          {fields.map((fieldItem, index) => { // Renamed `item` to `fieldItem` to avoid conflict
            const selectedProductForUnits = allProducts.find(p => p.id === watchItems[index]?.productId);
            const availableUnits: ProductUnit[] = selectedProductForUnits ? 
                (selectedProductForUnits.baseUnit === selectedProductForUnits.purchaseUnit ? [selectedProductForUnits.baseUnit] : [selectedProductForUnits.baseUnit, selectedProductForUnits.purchaseUnit]) 
                : ['piece'];

            return (
            <Card key={fieldItem.id} className="mb-4 p-4 space-y-3 bg-card/50 dark:bg-card/80">
              <FormField
                control={form.control}
                name={`items.${index}.productId`}
                render={({ field: RHFfield }) => ( // RHFfield for react-hook-form's field object
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover 
                        open={openComboboxIndex === index} 
                        onOpenChange={(isOpen) => {
                            setOpenComboboxIndex(isOpen ? index : null);
                        }}
                    >
                      <PopoverTrigger asChild>
                        {/* This Input is the main text search field */}
                        <Input
                          placeholder="Type to search product..."
                          value={itemSearchTexts[index] || ""}
                          onChange={(e) => {
                            const newSearchTexts = [...itemSearchTexts];
                            newSearchTexts[index] = e.target.value;
                            setItemSearchTexts(newSearchTexts);
                            RHFfield.onChange(''); // Clear actual productId from form while user is typing
                            setOpenComboboxIndex(index); // Keep/open popover while typing
                          }}
                          onFocus={() => {
                              // Open popover on focus if there are products or existing search text
                              if (allProducts.length > 0 || (itemSearchTexts[index] || "").trim()) {
                                  setOpenComboboxIndex(index);
                              }
                          }}
                          className="w-full"
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width)] p-0" align="start" side="bottom">
                        <Command>
                          <CommandList>
                            <CommandEmpty>
                              {(itemSearchTexts[index] || "").trim() ? "No product found." : "Type to search..."}
                            </CommandEmpty>
                            <CommandGroup>
                              {allProducts
                                .filter(p => {
                                    const searchText = (itemSearchTexts[index] || "").toLowerCase().trim();
                                    if (!searchText) return true; // Show all if search is empty
                                    return p.name.toLowerCase().includes(searchText) ||
                                           (p.sku && p.sku.toLowerCase().includes(searchText));
                                  }
                                )
                                .slice(0, 10) // Limit results
                                .map((product) => (
                                <CommandItem
                                  value={product.name} // Keep this for CMDK
                                  key={product.id}
                                  onSelect={() => {
                                    // RHFfield.onChange(product.id); // This sets the form's productId
                                    handleProductSelectInternal(index, product.id); // Custom handler updates text & form
                                    setOpenComboboxIndex(null); // Close popover
                                  }}
                                  disabled={product.quantityInStock === 0}
                                  className="cursor-pointer flex justify-between items-center"
                                >
                                  <span>
                                    {product.name} (Stock: {product.quantityInStock} {product.baseUnit})
                                  </span>
                                  {RHFfield.value === product.id && ( // Check if this product is selected
                                    <Check className="ml-2 h-4 w-4" />
                                  )}
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name={`items.${index}.quantitySold`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 2" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} min="1" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`items.${index}.soldUnit`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Sold</FormLabel>
                      <Select 
                        onValueChange={(value) => handleSoldUnitChange(index, value as ProductUnit)} 
                        value={field.value}
                        disabled={!selectedProductForUnits}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableUnits.map(unit => (
                            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input type="number" placeholder="e.g., 700.00" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
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
                  onClick={() => handleRemoveItem(index)}
                  disabled={fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Remove Item
                </Button>
              </div>
            </Card>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="w-full mt-2"
            onClick={handleAddItem}
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

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Any additional notes for this sale..." {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
          ) : ( 
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
