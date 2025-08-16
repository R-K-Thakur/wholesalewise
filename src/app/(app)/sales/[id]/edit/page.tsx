
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Check, ChevronsUpDown, PackagePlus, Truck, Save, ShieldAlert, Edit } from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { Product, Sale } from "@/lib/types";
import { getProductsAction, addProduct as addProductAction } from "../../../products/actions";
import { productFormSchema as addProductFormSchema, type ValidatedProductFormData as AddProductFormData } from "../../../products/schema";
import { useToast } from "@/hooks/use-toast";
import { updateSaleAction, getSaleByIdAction } from "../../actions";
import { saleFormSchema, type SaleFormData, type RecordSaleActionPayload } from "../../schema";
import type { ProductUnit } from "@/lib/constants";
import { PRODUCT_UNITS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { getSession, type SessionData } from "@/app/login/actions";

interface SaleFormProps {
  allProducts: Product[];
  onProductAdded: () => Promise<void>;
  currentUserRole: SessionData['role'] | undefined;
  existingSaleData: Sale;
}

function EditSaleForm({ allProducts, onProductAdded, currentUserRole, existingSaleData }: SaleFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      saleType: 'wholesale',
      saleDate: new Date(existingSaleData.saleDate).toISOString().split('T')[0],
      items: existingSaleData.items.map(item => ({
        productId: item.productId || '',
        quantitySold: item.quantitySold,
        pricePerUnitSold: item.pricePerUnitSold,
        soldUnit: item.soldUnit,
        productNameSnapshot: item.productNameSnapshot, // Keep snapshot for display
      })),
      paymentMethod: existingSaleData.paymentMethod || 'cash',
      customerName: existingSaleData.customerName || '',
      notes: existingSaleData.notes || '',
      packagingCharges: existingSaleData.packagingCharges,
      transportCharges: existingSaleData.transportCharges,
      amountPaid: existingSaleData.totalPaidAmount,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const currentWatchedItems = form.watch("items");
  const watchedPackagingCharges = form.watch("packagingCharges");
  const watchedTransportCharges = form.watch("transportCharges");
  const watchedAmountPaid = form.watch("amountPaid");

  const itemsTotal = React.useMemo(() => {
    return (currentWatchedItems || []).reduce((sum, item) => {
      const quantity = Number(item?.quantitySold) || 0;
      const price = Number(item?.pricePerUnitSold) || 0;
      return sum + (quantity * price);
    }, 0);
  }, [JSON.stringify(currentWatchedItems)]);

  const grandTotal = React.useMemo(() => {
    const packaging = Number(watchedPackagingCharges) || 0;
    const transport = Number(watchedTransportCharges) || 0;
    return parseFloat((itemsTotal + packaging + transport).toFixed(2));
  }, [itemsTotal, watchedPackagingCharges, watchedTransportCharges]);

  const amountPaidDisplay = Number(watchedAmountPaid) || 0;
  const amountDue = parseFloat((grandTotal - amountPaidDisplay).toFixed(2));

  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);
  const [itemSearchTexts, setItemSearchTexts] = React.useState<string[]>(() =>
    (form.getValues("items") || []).map((item) => {
        const product = allProducts.find(p => p.id === item.productId);
        return product?.name || item.productNameSnapshot || "";
    })
  );
  
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
      purchasePrice: 0,
      retailPricePerBaseUnit: '' as unknown as number, // Zod default
      wholesalePricePerBaseUnit: '' as unknown as number,
      initialStock: 0,
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
  }, [JSON.stringify(currentWatchedItems), allProducts, itemSearchTexts]);


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

      let pricePerSoldUnit = product.wholesalePricePerBaseUnit;
      if (product.baseUnit !== product.purchaseUnit && product.purchaseUnitConversionFactor > 0 && form.getValues(`items.${itemIndex}.soldUnit`) === product.purchaseUnit) {
        pricePerSoldUnit = product.wholesalePricePerBaseUnit * product.purchaseUnitConversionFactor;
      }

      form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), { shouldDirty: true, shouldValidate: true });

      const newSearchTexts = [...itemSearchTexts];
      newSearchTexts[itemIndex] = product.name;
      setItemSearchTexts(newSearchTexts);

      form.trigger(`items.${itemIndex}`);
      setOpenComboboxIndex(null);
    }
  };


  const handleSoldUnitChange = (itemIndex: number, newSoldUnit: ProductUnit) => {
    form.setValue(`items.${itemIndex}.soldUnit`, newSoldUnit, { shouldDirty: true });
    const product = allProducts.find(p => p.id === form.getValues(`items.${itemIndex}.productId`));
    if (product) {
        let pricePerSoldUnit = product.wholesalePricePerBaseUnit;
        if (newSoldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor && product.purchaseUnitConversionFactor > 0) {
            pricePerSoldUnit = product.wholesalePricePerBaseUnit * product.purchaseUnitConversionFactor;
        }
        form.setValue(`items.${itemIndex}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), { shouldValidate: true, shouldDirty: true });
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
    if (productJustAddedId && quickAddItemIndex !== null) {
      const newlyAddedProduct = allProducts.find(p => p.id === productJustAddedId);
      if (newlyAddedProduct) {
        handleProductSelectInternal(quickAddItemIndex, newlyAddedProduct.id);
      }
      setProductJustAddedId(null);
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
    const finalAmountPaid = Number(data.amountPaid) || 0;

    if (finalAmountPaid > finalGrandTotalForSubmission + 0.001) {
        form.setError("amountPaid", {message: "Amount paid cannot exceed the grand total."});
        toast({title: "Validation Error", description: `Amount paid (Rs. ${finalAmountPaid.toFixed(2)}) cannot exceed the grand total (Rs. ${finalGrandTotalForSubmission.toFixed(2)}).`, variant: "destructive"});
        return;
    }
    
    try {
      const result = await updateSaleAction(existingSaleData.id, data, itemsForAction);
      if (result.success) {
        toast({ title: "Success!", description: result.message });
        router.push(`/sales/${existingSaleData.id}`);
      } else {
        toast({ title: "Error Updating Sale", description: result.message || "Failed to update sale.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to update sale:", error);
      toast({ title: "Error", description: "An unexpected error occurred while updating the sale.", variant: "destructive" });
    }
  }

  const openQuickAddModal = (index: number) => {
    const productName = itemSearchTexts[index]?.trim();
    if (!productName) {
      toast({ title: "Product Name Missing", description: "Please type a product name first.", variant: "destructive" });
      return;
    }
    setQuickAddItemIndex(index);
    setQuickAddProductName(productName);
    quickAddForm.reset({
      productName: productName,
      category: PRODUCT_CATEGORIES[0],
      baseUnit: PRODUCT_UNITS[0],
      purchaseUnit: PRODUCT_UNITS[0],
      purchaseUnitConversionFactor: 1,
      purchasePrice: 0,
      retailPricePerBaseUnit: '' as unknown as number,
      wholesalePricePerBaseUnit: '' as unknown as number,
      initialStock: 0,
      reorderThreshold: 0,
    });
    if (currentUserRole === 'staff') quickAddForm.setValue("purchasePrice", 0);
    setIsQuickAddModalOpen(true);
  };
  
  const qafWholesalePriceUnitLabel = qafWatchedBaseUnit === qafWatchedPurchaseUnit ? qafWatchedBaseUnit : qafWatchedPurchaseUnit || "Purchase Unit";

  const handleQuickAddSubmit = async (data: AddProductFormData) => {
    setIsSubmittingQuickAdd(true);
    let submissionData = { ...data };
    submissionData.productName = submissionData.productName.trim();
    submissionData.initialStock = 0;
    submissionData.purchasePrice = currentUserRole === 'staff' ? 0 : (Number(data.purchasePrice) || 0);
    submissionData.retailPricePerBaseUnit = data.retailPricePerBaseUnit ?? 0;
    if (currentUserRole !== 'staff' && submissionData.purchasePrice <=0 ) {
        quickAddForm.setError("purchasePrice", {type: "manual", message: "Owner must set a positive purchase price."});
        setIsSubmittingQuickAdd(false);
        return;
    }
    if (submissionData.baseUnit !== submissionData.purchaseUnit && submissionData.purchaseUnitConversionFactor && submissionData.purchaseUnitConversionFactor > 0) {
      const enteredWholesalePrice = submissionData.wholesalePricePerBaseUnit;
      submissionData.wholesalePricePerBaseUnit = parseFloat((enteredWholesalePrice / submissionData.purchaseUnitConversionFactor).toFixed(2));
    }

    try {
      const result = await addProductAction(submissionData);
      if (result.success && result.product) {
        toast({ title: "Product Added", description: `${result.product.name} added to inventory. Stock is 0.` });
        await onProductAdded();
        setProductJustAddedId(result.product.id);
        setIsQuickAddModalOpen(false);
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                            key={`product-search-trigger-${fieldItem.id}`}
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
                            key={`product-search-input-${fieldItem.id}`}
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
                            {isAdHocItem && !availableUnits.includes(field.value) && PRODUCT_UNITS.filter(u => !availableUnits.includes(u)).map(u => (
                                <SelectItem key={`adhoc-${u}`} value={u}>{u}</SelectItem>
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
                              onChange={e => field.onChange(e.target.value)}
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
                          onChange={e => field.onChange(e.target.value)}
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
                          onChange={e => field.onChange(e.target.value)}
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
                            onChange={e => field.onChange(e.target.value)}
                             />
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
              <Link href={`/sales/${existingSaleData.id}`}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || (allProducts.length === 0 && currentWatchedItems.some(item => !item.productId && !itemSearchTexts[currentWatchedItems.indexOf(item)]?.trim())) }>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={isQuickAddModalOpen} onOpenChange={(isOpen) => {
        setIsQuickAddModalOpen(isOpen);
        if (!isOpen) setQuickAddItemIndex(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Product to Inventory</DialogTitle>
            <DialogDescription>
              Quickly add "{quickAddProductName}" to your inventory. Initial stock will be set to 0.
              {currentUserRole === 'staff' && " Purchase price will be set by owner later."}
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
                      <FormControl><Input type="number" placeholder="e.g., 12" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || '')} /></FormControl>
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
              {currentUserRole !== 'staff' && (
                 <FormField
                    control={quickAddForm.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Price (Rs. per {quickAddForm.getValues("purchaseUnit") || 'Purchase Unit'})</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              )}
              {currentUserRole === 'staff' && (
                  <div className="space-y-1">
                    <FormLabel>Purchase Price</FormLabel>
                    <div className="p-3 border rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
                        <div className="flex items-start gap-2">
                            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>Will be set to Rs. 0. Owner can update later.</span>
                        </div>
                    </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={quickAddForm.control}
                  name="retailPricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retail Price (Rs. per {quickAddForm.getValues("baseUnit") || 'Base Unit'}) (Optional)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={quickAddForm.control}
                  name="wholesalePricePerBaseUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale Price (Rs. per {qafWholesalePriceUnitLabel})</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value)} /></FormControl>
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
                      <FormControl><Input type="number" step="1" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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


export default function EditSalePage() {
  const params = useParams();
  const saleId = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [existingSale, setExistingSale] = React.useState<Sale | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = React.useState<SessionData['role'] | undefined>(undefined);

  const fetchInitialData = React.useCallback(async () => {
    if (!saleId) {
        setError("Sale ID is missing.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedProducts, session, fetchedSale] = await Promise.all([
        getProductsAction(),
        getSession(),
        getSaleByIdAction(saleId),
      ]);
      
      if (!session || session.role !== 'owner') {
        toast({ title: "Unauthorized", description: "You do not have permission to edit this sale.", variant: "destructive" });
        router.push(`/sales/${saleId}`);
        return;
      }
      
      if (!fetchedSale) {
        setError("Sale not found.");
        toast({ title: "Error", description: "The requested sale could not be found.", variant: "destructive" });
        router.push("/sales");
        return;
      }

      setProducts(fetchedProducts);
      setCurrentUserRole(session?.role);
      setExistingSale(fetchedSale);

    } catch (e) {
      console.error("Failed to fetch data for edit sale page:", e);
      setError(e instanceof Error ? e.message : "Failed to load initial data.");
    } finally {
      setIsLoading(false);
    }
  }, [saleId, router, toast]);

  React.useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={saleId ? `/sales/${saleId}` : "/sales"}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Sale Details</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Edit Sale</h1>
      </div>

      <Card className="max-w-3xl mx-auto w-full">
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
          <CardDescription>Modify the items, charges, and payments for this sale.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground mt-2">Loading sale data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
               <p>{error}</p>
               <Button variant="outline" onClick={fetchInitialData} className="mt-4">Try Again</Button>
            </div>
          ) : existingSale ? (
            <EditSaleForm 
                allProducts={products} 
                onProductAdded={fetchInitialData} 
                currentUserRole={currentUserRole} 
                existingSaleData={existingSale}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
