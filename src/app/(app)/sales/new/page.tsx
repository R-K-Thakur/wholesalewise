
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Check, ChevronsUpDown, PackagePlus, Truck, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { getProductsAction, addProduct as addProductAction } from "../../products/actions";
import { productFormSchema as addProductFormSchema, type ValidatedProductFormData as AddProductFormData } from "../../products/schema";
import { useToast } from "@/hooks/use-toast";
import { recordSaleAction } from "../actions";
import { saleFormSchema, type SaleFormData, type RecordSaleActionPayload } from "../schema";
import type { ProductUnit } from "@/lib/constants";
import { PRODUCT_UNITS, PRODUCT_CATEGORIES } from "@/lib/constants";


interface SaleFormProps {
  allProducts: Product[];
  onProductAdded: () => Promise<void>; // Callback to refresh products in parent
}

function SaleForm({ allProducts, onProductAdded }: SaleFormProps) {
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
      }],
      paymentMethod: 'cash',
      customerName: '',
      notes: '',
      packagingCharges: 0,
      transportCharges: 0,
      amountPaid: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const currentWatchedItems = form.watch("items");
  const watchedSaleType = form.watch("saleType");
  const watchedPackagingCharges = form.watch("packagingCharges");
  const watchedTransportCharges = form.watch("transportCharges");
  const watchedAmountPaid = form.watch("amountPaid");

  const itemsTotal = React.useMemo(() => {
    return (currentWatchedItems || []).reduce((sum, item) => {
      const quantity = Number(item?.quantitySold) || 0;
      const price = Number(item?.pricePerUnitSold) || 0;
      return sum + (quantity * price);
    }, 0);
  }, [currentWatchedItems]);

  const grandTotal = React.useMemo(() => {
    const packaging = Number(watchedPackagingCharges) || 0;
    const transport = Number(watchedTransportCharges) || 0;
    return parseFloat((itemsTotal + packaging + transport).toFixed(2));
  }, [itemsTotal, watchedPackagingCharges, watchedTransportCharges]);

  const amountPaidDisplay = Number(watchedAmountPaid) || 0;
  const amountDue = parseFloat((grandTotal - amountPaidDisplay).toFixed(2));

  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);
  const [itemSearchTexts, setItemSearchTexts] = React.useState<string[]>(() =>
    (form.getValues("items") || []).map(() => "")
  );

  // State for Quick Add Product Modal
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
  const [quickAddItemIndex, setQuickAddItemIndex] = React.useState<number | null>(null);
  const [quickAddProductName, setQuickAddProductName] = React.useState("");
  const [isSubmittingQuickAdd, setIsSubmittingQuickAdd] = React.useState(false);
  const [productJustAddedId, setProductJustAddedId] = React.useState<string | null>(null);


  const quickAddForm = useForm<AddProductFormData>({
    resolver: zodResolver(addProductFormSchema),
    defaultValues: {
      productName: "",
      category: PRODUCT_CATEGORIES[0],
      baseUnit: PRODUCT_UNITS[0],
      purchaseUnit: PRODUCT_UNITS[0],
      purchaseUnitConversionFactor: 1,
      purchasePrice: '' as unknown as number,
      retailPricePerBaseUnit: '' as unknown as number,
      wholesalePricePerBaseUnit: '' as unknown as number,
      initialStock: 0, // Default initial stock to 0 for quick add
      reorderThreshold: 0,
    },
  });

  const qafWatchedBaseUnit = quickAddForm.watch("baseUnit");
  const qafWatchedPurchaseUnit = quickAddForm.watch("purchaseUnit");

  const qafShowConversionFactorInput = React.useMemo(() => {
    if (qafWatchedBaseUnit === qafWatchedPurchaseUnit) return false;
    if (qafWatchedPurchaseUnit === "dozen" && qafWatchedBaseUnit === "piece") return false;
    return true;
  }, [qafWatchedBaseUnit, qafWatchedPurchaseUnit]);

  React.useEffect(() => {
    if (qafWatchedPurchaseUnit === "dozen" && qafWatchedBaseUnit === "piece") {
      quickAddForm.setValue("purchaseUnitConversionFactor", 12, { shouldValidate: true });
    } else if (qafWatchedBaseUnit === qafWatchedPurchaseUnit) {
      quickAddForm.setValue("purchaseUnitConversionFactor", 1, { shouldValidate: true });
    }
  }, [qafWatchedBaseUnit, qafWatchedPurchaseUnit, quickAddForm]);


  React.useEffect(() => {
    const newSearchTexts = [...itemSearchTexts];
    let changed = false;
    currentWatchedItems.forEach((formItem, i) => {
      if (newSearchTexts[i] === undefined) {
        newSearchTexts[i] = "";
        changed = true;
      }
      const product = allProducts.find(p => p.id === formItem.productId);
      if (product && newSearchTexts[i] !== product.name) {
        newSearchTexts[i] = product.name;
        changed = true;
      }
    });
    if (changed) {
      setItemSearchTexts(newSearchTexts);
    }
  }, [currentWatchedItems, allProducts]); // Removed itemSearchTexts from dep array


  React.useEffect(() => {
    const actualFormAmountPaid = Number(form.getValues("amountPaid")) || 0;
    const roundedGrandTotal = parseFloat(grandTotal.toFixed(2));

    if ((form.formState.dirtyFields.amountPaid !== true || roundedGrandTotal === 0) && roundedGrandTotal >= 0) {
      form.setValue("amountPaid", roundedGrandTotal, { shouldValidate: true, shouldDirty: true });
    } else if (actualFormAmountPaid > roundedGrandTotal && roundedGrandTotal >= 0) {
      form.setValue("amountPaid", roundedGrandTotal, { shouldValidate: true, shouldDirty: true });
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
      form.setValue(`items.${itemIndex}.productId`, product.id, { shouldDirty: true });
      form.setValue(`items.${itemIndex}.soldUnit`, product.baseUnit, { shouldDirty: true });

      const currentSaleType = form.getValues("saleType");
      const pricePerBaseUnit = currentSaleType === 'wholesale'
          ? product.wholesalePricePerBaseUnit
          : product.retailPricePerBaseUnit;

      form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerBaseUnit.toFixed(2)), { shouldDirty: true, shouldValidate: true });

      const newSearchTexts = [...itemSearchTexts];
      newSearchTexts[itemIndex] = product.name;
      setItemSearchTexts(newSearchTexts);

      form.trigger(`items.${itemIndex}`);
      setOpenComboboxIndex(null);
    }
  };

  const handleProductSearchInputChange = (index: number, value: string) => {
    const newSearchTexts = [...itemSearchTexts];
    newSearchTexts[index] = value;
    setItemSearchTexts(newSearchTexts);

    const currentProductId = form.getValues(`items.${index}.productId`);
    if (currentProductId) {
        const selectedProduct = allProducts.find(p => p.id === currentProductId);
        if (selectedProduct && selectedProduct.name.toLowerCase() !== value.toLowerCase()) {
            form.setValue(`items.${index}.productId`, '', { shouldDirty: true });
            form.setValue(`items.${index}.pricePerUnitSold`, 0, { shouldDirty: true, shouldValidate: true });
            form.setValue(`items.${index}.soldUnit`, PRODUCT_UNITS[0], { shouldDirty: true });
        }
    }
  };


  React.useEffect(() => {
    currentWatchedItems.forEach((item, index) => {
        const product = allProducts.find(p => p.id === item.productId);
        if (product) {
            const price = watchedSaleType === 'wholesale'
                ? product.wholesalePricePerBaseUnit
                : product.retailPricePerBaseUnit;

            let pricePerSoldUnit = price;
            if (item.soldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor > 0) {
                pricePerSoldUnit = price * product.purchaseUnitConversionFactor;
            }

            const currentPriceInForm = form.getValues(`items.${index}.pricePerUnitSold`);
            const newCalculatedPrice = parseFloat(pricePerSoldUnit.toFixed(2));

            if (typeof currentPriceInForm !== 'number' || Math.abs(currentPriceInForm - newCalculatedPrice) > 0.001) {
                 form.setValue(`items.${index}.pricePerUnitSold`, newCalculatedPrice, { shouldValidate: true, shouldDirty: true });
            }
        }
    });
  }, [watchedSaleType, currentWatchedItems, allProducts, form]);

  // Effect to auto-select the newly added product after `allProducts` is refreshed
  React.useEffect(() => {
    if (productJustAddedId && quickAddItemIndex !== null) {
      const newlyAddedProduct = allProducts.find(p => p.id === productJustAddedId);
      if (newlyAddedProduct) {
        handleProductSelectInternal(quickAddItemIndex, newlyAddedProduct.id);
      }
      setProductJustAddedId(null); // Reset flag
      // quickAddItemIndex is reset when modal closes
    }
  }, [allProducts, productJustAddedId, quickAddItemIndex]);


  async function onSubmit(data: SaleFormData) {
    form.clearErrors();

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
          form.setError(`items.${index}.productId`, {message: "Invalid product selected."});
          hasError = true;
          continue;
        }
        productNameForPayload = product.name;
        baseUnitForPayload = product.baseUnit;
      } else {
        if (currentItemSearchText === "") {
          form.setError(`items.${index}.productId`, {message: "Product name is required for unlisted items."});
          hasError = true;
          continue;
        }
        productNameForPayload = currentItemSearchText;
        baseUnitForPayload = formItem.soldUnit;
        productIdForPayload = undefined;
      }

      const itemTotal = parseFloat(((formItem.quantitySold || 0) * (formItem.pricePerUnitSold || 0)).toFixed(2));
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

    if (hasError) {
        toast({title: "Validation Error", description: "Please correct the errors in the form.", variant: "destructive"});
        return;
    }
    
    const finalItemsTotal = itemsForAction.reduce((sum, item) => sum + item.total, 0);
    const finalPackagingCharges = Number(data.packagingCharges) || 0;
    const finalTransportCharges = Number(data.transportCharges) || 0;
    const finalGrandTotalForSubmission = parseFloat((finalItemsTotal + finalPackagingCharges + finalTransportCharges).toFixed(2));

    if (data.amountPaid > finalGrandTotalForSubmission + 0.001) {
        form.setError("amountPaid", {message: "Amount paid cannot exceed the grand total."});
        toast({title: "Validation Error", description: "Amount paid cannot exceed the grand total.", variant: "destructive"});
        return;
    }

    const payload: RecordSaleActionPayload = {
      saleType: data.saleType,
      saleDate: data.saleDate,
      customerName: data.customerName || undefined,
      notes: data.notes || undefined,
      paymentMethod: data.paymentMethod,
      items: itemsForAction,
      packagingCharges: finalPackagingCharges > 0 ? finalPackagingCharges : undefined,
      transportCharges: finalTransportCharges > 0 ? finalTransportCharges : undefined,
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
        setItemSearchTexts((form.getValues("items") || []).map(() => ""));
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
    form.setValue(`items.${itemIndex}.soldUnit`, newSoldUnit, { shouldDirty: true });
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
        form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), { shouldValidate: true, shouldDirty: true });
    }
  };

  const openQuickAddModal = (index: number) => {
    const productName = itemSearchTexts[index]?.trim();
    if (!productName) {
      toast({ title: "Product Name Missing", description: "Please type a product name first.", variant: "destructive" });
      return;
    }
    setQuickAddItemIndex(index);
    setQuickAddProductName(productName);
    quickAddForm.reset({ // Reset form with default values and pre-fill name
      productName: productName,
      category: PRODUCT_CATEGORIES[0],
      baseUnit: PRODUCT_UNITS[0],
      purchaseUnit: PRODUCT_UNITS[0],
      purchaseUnitConversionFactor: 1,
      purchasePrice: '' as unknown as number,
      retailPricePerBaseUnit: '' as unknown as number,
      wholesalePricePerBaseUnit: '' as unknown as number,
      initialStock: 0, // Crucial for quick add
      reorderThreshold: 0,
    });
    setIsQuickAddModalOpen(true);
  };

  const handleQuickAddSubmit = async (data: AddProductFormData) => {
    setIsSubmittingQuickAdd(true);
    // Ensure initialStock is 0 for the action payload if it's part of the form
    const payload = { ...data, initialStock: 0 };

    try {
      const result = await addProductAction(payload);
      if (result.success && result.product) {
        toast({ title: "Product Added", description: `${result.product.name} added to inventory.` });
        await onProductAdded(); // Refresh products in parent
        setProductJustAddedId(result.product.id); // Set flag to select this product
        setIsQuickAddModalOpen(false);
        setQuickAddItemIndex(null);
      } else {
        toast({ title: "Error Adding Product", description: result.message || "Failed to add product.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmittingQuickAdd(false);
    }
  };

  return (
    <>
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
              let availableUnits: ProductUnit[] = [...PRODUCT_UNITS];
              if (selectedProductForUnits) {
                  availableUnits = (selectedProductForUnits.baseUnit === selectedProductForUnits.purchaseUnit)
                      ? [selectedProductForUnits.baseUnit]
                      : [selectedProductForUnits.baseUnit, selectedProductForUnits.purchaseUnit].filter(Boolean) as ProductUnit[];
              }
              const popoverTriggerText = itemSearchTexts[index] || "Select or Type Product";
              const isAdHocItem = !currentProductId && itemSearchTexts[index]?.trim() !== "";

              return (
              <Card key={fieldItem.id} className="mb-4 p-4 space-y-3 bg-card/50 dark:bg-card/80">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                  <FormItem className="flex-grow">
                    <FormLabel>Product</FormLabel>
                    <Popover open={openComboboxIndex === index} onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}>
                      <PopoverTrigger asChild>
                        <Button
                            key={`product-search-${fieldItem.id}`}
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !itemSearchTexts[index] && "text-muted-foreground"
                            )}
                            onClick={() => setOpenComboboxIndex(openComboboxIndex === index ? null : index)}
                          >
                            <span className="truncate">{popoverTriggerText}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search or type product name..."
                            value={itemSearchTexts[index]}
                            onValueChange={(searchValue) => handleProductSearchInputChange(index, searchValue)}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {itemSearchTexts[index]?.trim() !== "" ? `No product found. Type full name to add as unlisted item.` : "Start typing..."}
                            </CommandEmpty>
                            <CommandGroup>
                              {allProducts
                                .filter(p => {
                                  const searchText = (itemSearchTexts[index] || "").toLowerCase().trim();
                                  if (!searchText) return true;
                                  return p.name.toLowerCase().includes(searchText) ||
                                    (p.sku && p.sku.toLowerCase().includes(searchText));
                                })
                                .slice(0, 10)
                                .map((product) => (
                                  <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={() => handleProductSelectInternal(index, product.id)}
                                    disabled={product.quantityInStock === 0}
                                    className={cn(product.quantityInStock === 0 && "opacity-50 cursor-not-allowed")}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        currentProductId === product.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {product.name} (Stock: {product.quantityInStock} {product.baseUnit})
                                    {product.quantityInStock === 0 && <span className="ml-auto text-xs text-destructive">Out of Stock</span>}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage>{form.formState.errors.items?.[index]?.productId?.message}</FormMessage>
                  </FormItem>
                  {isAdHocItem && (
                    <Button type="button" variant="outline" size="sm" onClick={() => openQuickAddModal(index)} className="mt-auto sm:mt-[26px] flex-shrink-0">
                      <PlusCircle className="h-4 w-4 mr-1" /> Add to Inventory
                    </Button>
                  )}
                </div>

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
                          disabled={availableUnits.length === 0 && !currentProductId && !itemSearchTexts[index]?.trim()}
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
                        <FormLabel>Rate/Unit (Rs.)</FormLabel>
                        <FormControl>
                          <Input
                              type="number"
                              placeholder="e.g., 700.00"
                              step="0.01" {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                              disabled={!!currentProductId}
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

          <div className="mt-6 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <FormField
              control={form.control}
              name="packagingCharges"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><PackagePlus className="h-4 w-4 text-muted-foreground" />Packaging Charges (Rs.)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 50.00" step="0.01" {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="transportCharges"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1"><Truck className="h-4 w-4 text-muted-foreground" />Transport Charges (Rs.)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 100.00" step="0.01" {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                          min="0" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <p className="text-sm text-muted-foreground">Items Total: Rs. {itemsTotal.toFixed(2)}</p>
                  { (Number(watchedPackagingCharges) || 0) > 0 &&
                    <p className="text-sm text-muted-foreground">Packaging: Rs. {(Number(watchedPackagingCharges) || 0).toFixed(2)}</p>
                  }
                  { (Number(watchedTransportCharges) || 0) > 0 &&
                    <p className="text-sm text-muted-foreground">Transport: Rs. {(Number(watchedTransportCharges) || 0).toFixed(2)}</p>
                  }
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
            <Button type="submit" disabled={form.formState.isSubmitting || (allProducts.length === 0 && currentWatchedItems.some(item => !item.productId && !itemSearchTexts[currentWatchedItems.indexOf(item)]?.trim())) }>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Sale
            </Button>
          </div>
        </form>
      </Form>

      {/* Quick Add Product Modal */}
      <Dialog open={isQuickAddModalOpen} onOpenChange={(isOpen) => {
        setIsQuickAddModalOpen(isOpen);
        if (!isOpen) setQuickAddItemIndex(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Product to Inventory</DialogTitle>
            <DialogDescription>
              Quickly add "{quickAddProductName}" to your inventory. Initial stock will be set to 0.
            </DialogDescription>
          </DialogHeader>
          <Form {...quickAddForm}>
            <form onSubmit={quickAddForm.handleSubmit(handleQuickAddSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-3">
              <FormField
                control={quickAddForm.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={quickAddForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {PRODUCT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={quickAddForm.control}
                  name="purchaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Unit bought as" /></SelectTrigger></FormControl>
                        <SelectContent>{PRODUCT_UNITS.map(u => <SelectItem key={`qap-${u}`} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={quickAddForm.control}
                  name="baseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Unit (Sold As)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Smallest unit sold" /></SelectTrigger></FormControl>
                        <SelectContent>{PRODUCT_UNITS.map(u => <SelectItem key={`qab-${u}`} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {qafShowConversionFactorInput && (
                <FormField
                  control={quickAddForm.control}
                  name="purchaseUnitConversionFactor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conversion ({qafWatchedBaseUnit}s per {qafWatchedPurchaseUnit})</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 12" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || '')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(qafWatchedPurchaseUnit === "dozen" && qafWatchedBaseUnit === "piece") && (
                  <div className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/50">
                    Auto conversion: 1 dozen = 12 pieces.
                  </div>
              )}
               <FormField
                  control={quickAddForm.control}
                  name="purchasePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (Rs. per {quickAddForm.getValues("purchaseUnit") || 'Purchase Unit'})</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={quickAddForm.control}
                  name="retailPricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price (Rs. per {quickAddForm.getValues("baseUnit") || 'Base Unit'})</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={quickAddForm.control}
                  name="wholesalePricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale Price (Rs. per {quickAddForm.getValues("baseUnit") || 'Base Unit'})</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || '')} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               <FormField
                  control={quickAddForm.control}
                  name="reorderThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reorder Threshold (in {quickAddForm.getValues("baseUnit") || 'Base Units'}) (Optional)</FormLabel>
                      <FormControl><Input type="number" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Initial Stock is intentionally omitted from UI, will be set to 0 */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsQuickAddModalOpen(false)} disabled={isSubmittingQuickAdd}>Cancel</Button>
                <Button type="submit" disabled={isSubmittingQuickAdd}>
                  {isSubmittingQuickAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Product
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}


export default function NewSalePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProductsData = React.useCallback(async () => {
    // Set loading true only if not already loading to prevent UI flicker during quick add
    // setIsLoading(true); 
    setError(null);
    try {
      const fetchedProducts = await getProductsAction();
      setProducts(fetchedProducts);
    } catch (e) {
      console.error("Failed to fetch products for new sale page:", e);
      setError(e instanceof Error ? e.message : "Failed to load products.");
    } finally {
      setIsLoading(false); // Ensure loading is set to false after fetch
    }
  }, []);

  React.useEffect(() => {
    fetchProductsData();
  }, [fetchProductsData]);

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
          <CardDescription>Enter the details for the new sale. Select products from inventory or enter new product names directly. Unlisted items can be quickly added to inventory.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && products.length === 0 ? ( // Show loader only on initial load
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground mt-2">Loading products...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
               <p>{error}</p>
               <Button variant="outline" onClick={fetchProductsData} className="mt-4">Try Again</Button>
            </div>
          ) : (
            <SaleForm allProducts={products} onProductAdded={fetchProductsData} />
          )}
           { !isLoading && !error && products.length === 0 && (
             <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
               <p>No products found in inventory. You can still sell items by typing their names directly and adding them.</p>
               <Button variant="default" asChild className="mt-4">
                 <Link href="/products/new">Add Product to Inventory Manually</Link>
               </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    