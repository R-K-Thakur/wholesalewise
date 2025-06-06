
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Check, Search as SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
import { recordSaleAction } from "../actions";
import { saleFormSchema, type SaleFormData, type RecordSaleActionPayload, type SaleItemFormStructure } from "../schema";
import type { ProductUnit } from "@/lib/constants";
import { PRODUCT_UNITS } from "@/lib/constants";


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
        soldUnit: PRODUCT_UNITS[0], 
        // baseUnitSnapshot is not part of the form item directly
      }],
      paymentMethod: 'cash',
      customerName: '',
      notes: '',
      amountPaid: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const currentWatchedItems = form.watch("items");
  const currentWatchedAmountPaid = form.watch("amountPaid");
  const watchedSaleType = form.watch("saleType");

  const grandTotal = (currentWatchedItems || []).reduce((sum, item) => {
    const quantity = Number(item?.quantitySold) || 0;
    const price = Number(item?.pricePerUnitSold) || 0;
    return sum + (quantity * price);
  }, 0);

  const amountPaidDisplay = Number(currentWatchedAmountPaid) || 0;
  const amountDue = parseFloat((grandTotal - amountPaidDisplay).toFixed(2));

  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);
  const [itemSearchTexts, setItemSearchTexts] = React.useState<string[]>(() =>
    (form.getValues("items") || []).map(item => {
      if (item.productId) {
        const product = allProducts.find(p => p.id === item.productId);
        return product ? product.name : "";
      }
      return "";
    })
  );

  React.useEffect(() => {
    const newSearchTexts = currentWatchedItems.map((formItem, i) => {
      const existingSearchText = itemSearchTexts[i] || "";
      if (formItem.productId) {
        const product = allProducts.find(p => p.id === formItem.productId);
        return product ? product.name : existingSearchText;
      }
      return existingSearchText; // Keep manually typed text if no productId
    });
  
    if (newSearchTexts.length !== itemSearchTexts.length || newSearchTexts.some((text, i) => text !== itemSearchTexts[i])) {
      setItemSearchTexts(newSearchTexts);
    }
  }, [currentWatchedItems, allProducts, itemSearchTexts]);


  React.useEffect(() => {
    const actualFormAmountPaid = Number(form.getValues("amountPaid")) || 0;
    if (form.formState.dirtyFields.amountPaid !== true && grandTotal > 0) {
      form.setValue("amountPaid", parseFloat(grandTotal.toFixed(2)), { shouldValidate: true });
    } else if (actualFormAmountPaid > grandTotal && grandTotal >= 0) {
      form.setValue("amountPaid", parseFloat(grandTotal.toFixed(2)), { shouldValidate: true });
    }
  }, [grandTotal, form]);


  const handleAddItem = () => {
    append({
      productId: '',
      quantitySold: 1,
      pricePerUnitSold: 0,
      soldUnit: PRODUCT_UNITS[0],
    });
    setItemSearchTexts(prev => [...prev, ""]);
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length <= 1) {
      toast({ title: "Cannot remove last item", description: "A sale must have at least one item.", variant: "destructive" });
      return;
    }
    remove(index);
    setItemSearchTexts(prev => prev.filter((_, i) => i !== index));
  };

  const handleProductSelectInternal = (itemIndex: number, productIdToSelect: string) => {
    const product = allProducts.find(p => p.id === productIdToSelect);
    if (product) {
      if (product.quantityInStock === 0) {
        toast({ title: "Out of Stock", description: `${product.name} is out of stock. Cannot select.`, variant: "destructive" });
        return;
      }
      form.setValue(`items.${itemIndex}.productId`, product.id);
      // baseUnitSnapshot is derived, not set directly here.
      form.setValue(`items.${itemIndex}.soldUnit`, product.baseUnit);

      const currentSaleType = form.getValues("saleType");
      const pricePerBaseUnit = currentSaleType === 'wholesale'
          ? product.wholesalePricePerBaseUnit
          : product.retailPricePerBaseUnit;

      form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerBaseUnit.toFixed(2)));

      setItemSearchTexts(prevTexts => {
        const newTexts = [...prevTexts];
        newTexts[itemIndex] = product.name;
        return newTexts;
      });

      form.trigger(`items.${itemIndex}`);
      setOpenComboboxIndex(null);
    }
  };
  
  const handleProductSearchInputChange = (index: number, value: string) => {
    setItemSearchTexts(prev => {
      const newTexts = [...prev];
      newTexts[index] = value;
      return newTexts;
    });
    // If user types, clear selected productId to indicate manual/ad-hoc entry
    // unless they re-select from popover
    if (form.getValues(`items.${index}.productId`)) {
        const selectedProduct = allProducts.find(p => p.id === form.getValues(`items.${index}.productId`));
        if (selectedProduct?.name !== value) {
            form.setValue(`items.${index}.productId`, '');
            // For ad-hoc, price and unit are manual, so don't auto-clear them here.
            // User might be editing name of previously selected product to make it ad-hoc.
        }
    }
    if (!openComboboxIndex) setOpenComboboxIndex(index);
  };


  React.useEffect(() => {
    currentWatchedItems.forEach((item, index) => {
        const product = allProducts.find(p => p.id === item.productId);
        if (product) { // Only auto-update price if it's a selected product
            const price = watchedSaleType === 'wholesale'
                ? product.wholesalePricePerBaseUnit
                : product.retailPricePerBaseUnit;

            let pricePerSoldUnit = price;
            if (item.soldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor > 0) {
                pricePerSoldUnit = price * product.purchaseUnitConversionFactor;
            }
            
            const currentPriceInForm = form.getValues(`items.${index}.pricePerUnitSold`);
            if (typeof currentPriceInForm !== 'number' || Math.abs(currentPriceInForm - pricePerSoldUnit) > 0.001) {
                 form.setValue(`items.${index}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), { shouldValidate: true });
            }
        }
    });
  }, [watchedSaleType, currentWatchedItems, allProducts, form]);


  async function onSubmit(data: SaleFormData) {
    form.clearErrors();
    
    const finalGrandTotalForSubmission = (data.items || []).reduce((sum, item) => {
        const quantity = Number(item?.quantitySold) || 0;
        const price = Number(item?.pricePerUnitSold) || 0;
        return sum + (quantity * price);
    }, 0);

    if (data.amountPaid > finalGrandTotalForSubmission + 0.001) {
        form.setError("amountPaid", {message: "Amount paid cannot exceed the grand total."});
        toast({title: "Validation Error", description: "Amount paid cannot exceed the grand total.", variant: "destructive"});
        return;
    }

    const itemsForAction: RecordSaleActionPayload['items'] = [];
    let hasError = false;

    for (const [index, formItem] of data.items.entries()) {
      const currentItemSearchText = itemSearchTexts[index]?.trim() || "";
      let productNameForPayload: string;
      let baseUnitForPayload: ProductUnit;
      let productIdForPayload: string | undefined = formItem.productId || undefined;

      if (productIdForPayload) {
        const product = allProducts.find(p => p.id === productIdForPayload);
        if (!product) {
          toast({ title: "Error", description: `Invalid product selected for item ${index + 1}. Please re-select.`, variant: "destructive"});
          form.setError(`items.${index}.productId`, {message: "Invalid product selected."}); // Error on visual input
          hasError = true;
          continue;
        }
        productNameForPayload = product.name;
        baseUnitForPayload = product.baseUnit;
      } else { // Ad-hoc item
        if (currentItemSearchText === "") {
          toast({ title: "Error", description: `Product name is required for item ${index + 1} as it's not selected from inventory.`, variant: "destructive"});
          form.setError(`items.${index}.productId`, {message: "Product name is required for unlisted items."}); // Error on visual input
          hasError = true;
          continue;
        }
        productNameForPayload = currentItemSearchText;
        baseUnitForPayload = formItem.soldUnit; // For ad-hoc, base unit is same as sold unit
        productIdForPayload = undefined; 
      }

      const itemTotal = (formItem.quantitySold || 0) * (formItem.pricePerUnitSold || 0);
      itemsForAction.push({
        productId: productIdForPayload,
        productNameSnapshot: productNameForPayload,
        quantitySold: formItem.quantitySold,
        pricePerUnitSold: formItem.pricePerUnitSold,
        soldUnit: formItem.soldUnit,
        baseUnitSnapshot: baseUnitForPayload,
        total: itemTotal,
      });
    }

    if (hasError) return;

    const payload: RecordSaleActionPayload = {
      saleType: data.saleType,
      saleDate: data.saleDate,
      customerName: data.customerName || undefined,
      notes: data.notes || undefined,
      paymentMethod: data.paymentMethod,
      items: itemsForAction,
      totalAmount: finalGrandTotalForSubmission,
      amountPaid: data.amountPaid,
    };

    try {
      const result = await recordSaleAction(payload);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        form.reset();
        setItemSearchTexts(form.getValues("items").map(() => ""));
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

  const handleSoldUnitChange = (itemIndex: number, newSoldUnit: ProductUnit) => {
    form.setValue(`items.${itemIndex}.soldUnit`, newSoldUnit);
    const product = allProducts.find(p => p.id === form.getValues(`items.${itemIndex}.productId`));
    if (product) { // Only auto-update price if it's a selected (not ad-hoc) product
        const currentSaleType = form.getValues("saleType");
        const pricePerBaseUnit = currentSaleType === 'wholesale'
            ? product.wholesalePricePerBaseUnit
            : product.retailPricePerBaseUnit;

        let pricePerSoldUnit = pricePerBaseUnit;
        if (newSoldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor > 0) {
            pricePerSoldUnit = pricePerBaseUnit * product.purchaseUnitConversionFactor;
        }
        form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), { shouldValidate: true });
    }
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
                    Mark if this is a wholesale transaction. Prices adjust automatically for listed products.
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
          {fields.map((fieldItem, index) => {
            const currentProductId = currentWatchedItems[index]?.productId;
            const selectedProductForUnits = allProducts.find(p => p.id === currentProductId);
            
            let availableUnits: ProductUnit[] = [...PRODUCT_UNITS]; // Default for ad-hoc
            if (selectedProductForUnits) {
                availableUnits = (selectedProductForUnits.baseUnit === selectedProductForUnits.purchaseUnit)
                    ? [selectedProductForUnits.baseUnit]
                    : [selectedProductForUnits.baseUnit, selectedProductForUnits.purchaseUnit].filter(Boolean) as ProductUnit[];
            }

            return (
            <Card key={fieldItem.id} className="mb-4 p-4 space-y-3 bg-card/50 dark:bg-card/80">
              <FormField
                control={form.control}
                name={`items.${index}.productId`} 
                render={({ field }) => ( 
                  <FormItem className="flex flex-col">
                    <FormLabel>Product</FormLabel>
                    <Popover
                        open={openComboboxIndex === index}
                        onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Type to search or enter product name..."
                                value={itemSearchTexts[index] || ""}
                                onChange={(e) => handleProductSearchInputChange(index, e.target.value)}
                                onFocus={() => setOpenComboboxIndex(index)}
                                className="w-full pl-10"
                            />
                          </div>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 max-h-60 overflow-y-auto"
                        align="start"
                        side="bottom"
                       >
                        <div className="py-1">
                          {allProducts
                            .filter(p => {
                                const searchText = (itemSearchTexts[index] || "").toLowerCase().trim();
                                if (!searchText && !currentProductId) return true; // Show all if input empty & no product selected
                                if (!searchText && currentProductId) return p.name.toLowerCase().includes((allProducts.find(pr => pr.id === currentProductId)?.name || "").toLowerCase()); // If product selected, filter around its name
                                return p.name.toLowerCase().includes(searchText) ||
                                    (p.sku && p.sku.toLowerCase().includes(searchText));
                            })
                            .slice(0,10)
                            .map((product) => (
                            <div
                              key={product.id}
                              onClick={() => handleProductSelectInternal(index, product.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleProductSelectInternal(index, product.id);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              aria-pressed={field.value === product.id}
                              className={cn(
                                "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                                field.value === product.id && "bg-accent text-accent-foreground",
                                product.quantityInStock === 0 && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    field.value === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span>{product.name} (Stock: {product.quantityInStock} {product.baseUnit})</span>
                              </div>
                              {product.quantityInStock === 0 && <span className="text-xs text-destructive">Out of Stock</span>}
                            </div>
                          ))}
                          {allProducts.filter(p => {
                                const searchText = (itemSearchTexts[index] || "").toLowerCase().trim();
                                if (!searchText && !currentProductId) return true;
                                if (!searchText && currentProductId) return p.name.toLowerCase().includes((allProducts.find(pr => pr.id === currentProductId)?.name || "").toLowerCase());
                                return p.name.toLowerCase().includes(searchText) || (p.sku && p.sku.toLowerCase().includes(searchText));
                            }).length === 0 && itemSearchTexts[index]?.trim() !== "" && (
                               <div className="px-3 py-2 text-sm text-muted-foreground">No product found. Type full name for unlisted item.</div>
                            )
                          }
                        </div>
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
                        // For ad-hoc items, user can select any unit. For selected products, list is filtered.
                        disabled={!currentProductId && availableUnits.length === 0} 
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
                      <FormLabel>Price/Unit (Rs.)</FormLabel>
                      <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g., 700.00" 
                            step="0.01" {...field} 
                            onChange={e => field.onChange(parseFloat(e.target.value) || 0)} 
                            disabled={!!currentProductId} // Disabled if a product is selected from inventory
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="flex flex-col justify-end">
                    <FormLabel>Item Total (Rs.)</FormLabel>
                    <Input
                        type="text"
                        readOnly
                        disabled
                        value={((Number(currentWatchedItems[index]?.quantitySold) || 0) * (Number(currentWatchedItems[index]?.pricePerUnitSold) || 0)).toFixed(2)}
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

        <div className="mt-6 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel>Amount Paid (Rs.)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 500.00" step="0.01" {...field} 
                           onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2 text-right space-y-1">
                <p className="text-lg font-medium">
                    Grand Total: <span className="font-semibold">Rs. {grandTotal.toFixed(2)}</span>
                </p>
                <p className={`text-lg font-medium ${amountDue > 0.001 ? 'text-destructive' : 'text-green-600'}`}>
                    Amount Due: <span className="font-semibold">Rs. {amountDue.toFixed(2)}</span>
                </p>
            </div>
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
          <CardDescription>Enter the details for the new sale. Select products from inventory or enter new product names directly.</CardDescription>
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
           {/* Message for no products is okay even if ad-hoc is allowed, because ideally one would add products. */}
           { !isLoading && !error && products.length === 0 && (
             <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
               <p>No products found in inventory. You can still sell items by typing their names directly.</p>
               <Button variant="default" asChild className="mt-4">
                 <Link href="/products/new">Add Product to Inventory</Link>
               </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
