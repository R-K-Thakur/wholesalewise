
"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PlusCircle, Trash2, Loader2, Check, ChevronsUpDown, PackagePlus, Truck, Save, ShieldAlert, ScanLine, Tag, Camera, Minus, Plus, CreditCard, Banknote, Sparkles, Search, LayoutGrid, ChevronDown, ChevronUp, Building2, ShoppingBag } from "lucide-react";
import { CameraScannerDialog } from "./camera-scanner-dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Product, Customer } from "@/lib/types";
import { getProductsAction, addProduct as addProductAction } from "../../products/actions";
import { getCustomersAction } from "../../customers/actions";
import { productFormSchema as addProductFormSchema, type ValidatedProductFormData as AddProductFormData } from "../../products/schema";
import { useToast } from "@/hooks/use-toast";
import { recordSaleAction } from "../actions";
import { saleFormSchema, type SaleFormData, type RecordSaleActionPayload } from "../schema";
import type { ProductUnit } from "@/lib/constants";
import { PRODUCT_UNITS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { getSession, type SessionData } from "@/app/login/actions";
import { UserCircle, User, Phone, AlertCircle } from "lucide-react";


interface SaleFormProps {
  allProducts: Product[];
  allCustomers: Customer[];
  onProductAdded: () => Promise<void>;
  currentUserRole: SessionData['role'] | undefined;
}

function SaleForm({ allProducts, allCustomers, onProductAdded, currentUserRole }: SaleFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);
  const [isCustomerComboboxOpen, setIsCustomerComboboxOpen] = React.useState(false);
  const [customerSearchText, setCustomerSearchText] = React.useState("");
  const [barcodeScanInput, setBarcodeScanInput] = React.useState("");
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = React.useState(false);
  const [selectedQuickCategory, setSelectedQuickCategory] = React.useState<string>("All");
  const [showQuickPickGrid, setShowQuickPickGrid] = React.useState<boolean>(true);
  const barcodeInputRef = React.useRef<HTMLInputElement | null>(null);

  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      saleType: 'wholesale',
      saleDate: new Date().toISOString().split('T')[0],
      items: [{
        productId: '',
        quantitySold: 1,
        pricePerUnitSold: 0,
        soldUnit: PRODUCT_UNITS[0],
      }],
      paymentMethod: 'cash',
      customerId: '',
      customerName: '',
      customerPhone: '',
      notes: '',
      packagingCharges: undefined,
      transportCharges: undefined,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      amountPaid: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const currentWatchedItems = form.watch("items");
  const watchedSaleType = form.watch("saleType") || 'wholesale';
  const watchedPackagingCharges = form.watch("packagingCharges");
  const watchedTransportCharges = form.watch("transportCharges");
  const watchedDiscountType = form.watch("discountType") || "fixed";
  const watchedDiscountValue = form.watch("discountValue") || 0;
  const watchedAmountPaid = form.watch("amountPaid");

  const itemsTotal = React.useMemo(() => {
    return (currentWatchedItems || []).reduce((sum, item) => {
      const quantity = Number(item?.quantitySold) || 0;
      const price = Number(item?.pricePerUnitSold) || 0;
      return sum + (quantity * price);
    }, 0);
  }, [currentWatchedItems]);

  const discountAmount = React.useMemo(() => {
    if (watchedSaleType === 'wholesale') return 0;
    const val = Number(watchedDiscountValue) || 0;
    if (val <= 0) return 0;
    let disc = 0;
    if (watchedDiscountType === "percentage") {
      disc = (itemsTotal * val) / 100;
    } else {
      disc = val;
    }
    return parseFloat(Math.min(itemsTotal, disc).toFixed(2));
  }, [itemsTotal, watchedDiscountType, watchedDiscountValue, watchedSaleType]);

  const grandTotal = React.useMemo(() => {
    const packaging = Number(watchedPackagingCharges) || 0;
    const transport = Number(watchedTransportCharges) || 0;
    return parseFloat(Math.max(0, itemsTotal - discountAmount + packaging + transport).toFixed(2));
  }, [itemsTotal, discountAmount, watchedPackagingCharges, watchedTransportCharges]);

  React.useEffect(() => {
    const amountPaidFieldState = form.getFieldState("amountPaid");
    const numericAmountPaid = Number(form.getValues("amountPaid"));
    const roundedGrandTotal = parseFloat(grandTotal.toFixed(2));

    if (isNaN(roundedGrandTotal) || roundedGrandTotal < 0) {
      if (!amountPaidFieldState.isDirty && (isNaN(numericAmountPaid) || numericAmountPaid !== 0)) {
        form.setValue("amountPaid", 0, { shouldValidate: true, shouldDirty: false });
      }
      return;
    }

    if (!amountPaidFieldState.isDirty) {
      if (isNaN(numericAmountPaid) || Math.abs(numericAmountPaid - roundedGrandTotal) > 0.001) {
          form.setValue("amountPaid", roundedGrandTotal, { shouldValidate: true, shouldDirty: false });
      }
    } else {
      if (!isNaN(numericAmountPaid) && numericAmountPaid > roundedGrandTotal) {
        form.setValue("amountPaid", roundedGrandTotal, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [grandTotal, form]);


  const amountPaidDisplay = Number(watchedAmountPaid) || 0;
  const amountDue = parseFloat((grandTotal - amountPaidDisplay).toFixed(2));

  const handleSaleTypeChange = React.useCallback((newType: 'wholesale' | 'retail') => {
    form.setValue('saleType', newType, { shouldValidate: true, shouldDirty: true });

    if (newType === 'wholesale') {
      form.setValue('discountValue', 0, { shouldDirty: true, shouldValidate: true });
      form.setValue('discountAmount', 0, { shouldDirty: true, shouldValidate: true });
    }

    // Update all current items in the bill to reflect new pricing
    const currentItems = form.getValues('items') || [];
    let updatedCount = 0;

    currentItems.forEach((item, idx) => {
      if (!item.productId) return;
      const prod = allProducts.find((p) => p.id === item.productId);
      if (!prod) return;

      const basePrice =
        newType === 'retail'
          ? (prod.retailPricePerBaseUnit || prod.wholesalePricePerBaseUnit || 0)
          : (prod.wholesalePricePerBaseUnit || 0);

      let pricePerSoldUnit = basePrice;
      if (
        item.soldUnit === prod.purchaseUnit &&
        prod.purchaseUnit !== prod.baseUnit &&
        prod.purchaseUnitConversionFactor &&
        prod.purchaseUnitConversionFactor > 0
      ) {
        pricePerSoldUnit = basePrice * prod.purchaseUnitConversionFactor;
      }

      form.setValue(`items.${idx}.pricePerUnitSold`, parseFloat(pricePerSoldUnit.toFixed(2)), {
        shouldValidate: true,
        shouldDirty: true,
      });
      updatedCount++;
    });

    toast({
      title: newType === 'retail' ? "Switched to Retail Billing" : "Switched to Wholesale Billing",
      description: updatedCount > 0 
        ? `Recalculated ${updatedCount} item(s) to ${newType} prices.`
        : `New items added will use ${newType} rates.`,
    });
  }, [allProducts, form, toast]);


  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);
  const [itemSearchTexts, setItemSearchTexts] = React.useState<string[]>(() =>
    (form.getValues("items") || []).map(() => "")
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
  }, [currentWatchedItems, allProducts, itemSearchTexts]);


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

  const addProductToBill = React.useCallback((product: Product) => {
    if (product.quantityInStock <= 0) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is currently out of stock.`,
        variant: "destructive",
      });
      return;
    }

    const currentItems = form.getValues("items") || [];
    const existingIndex = currentItems.findIndex((i) => i.productId === product.id);

    const currentSaleType = form.getValues("saleType") || 'wholesale';
    const basePrice = currentSaleType === 'retail'
      ? (product.retailPricePerBaseUnit || product.wholesalePricePerBaseUnit || 0)
      : (product.wholesalePricePerBaseUnit || 0);

    if (existingIndex >= 0) {
      const currentQty = Number(currentItems[existingIndex].quantitySold) || 0;
      form.setValue(`items.${existingIndex}.quantitySold`, currentQty + 1, { shouldDirty: true, shouldValidate: true });
      toast({
        title: "Quantity Increased (+1)",
        description: `${product.name}: now ${currentQty + 1} ${currentItems[existingIndex].soldUnit}.`,
      });
    } else {
      if (currentItems.length === 1 && !currentItems[0].productId && !itemSearchTexts[0]) {
        form.setValue(`items.0.productId`, product.id, { shouldDirty: true });
        form.setValue(`items.0.soldUnit`, product.baseUnit, { shouldDirty: true });
        form.setValue(`items.0.pricePerUnitSold`, basePrice, { shouldDirty: true, shouldValidate: true });
        form.setValue("items.0.quantitySold", 1, { shouldDirty: true, shouldValidate: true });
        setItemSearchTexts([product.name]);
      } else {
        append({
          productId: product.id,
          quantitySold: 1,
          pricePerUnitSold: basePrice,
          soldUnit: product.baseUnit,
        });
        setItemSearchTexts((prev) => [...prev, product.name]);
      }
      toast({
        title: "Item Added to Bill",
        description: `${product.name} (Rs. ${basePrice}/${product.baseUnit} - ${currentSaleType === 'retail' ? 'Retail' : 'Wholesale'}).`,
      });
    }
  }, [form, itemSearchTexts, append, toast]);

  const processQuickSearchOrBarcode = (rawInput: string) => {
    const query = rawInput.trim().toLowerCase();
    if (!query) return;

    // 1. Exact barcode match
    let matchedProduct = allProducts.find(
      (p) => p.barcode && p.barcode.toLowerCase() === query
    );

    // 2. Exact SKU match
    if (!matchedProduct) {
      matchedProduct = allProducts.find(
        (p) => p.sku && p.sku.toLowerCase() === query
      );
    }

    // 3. Exact product name match
    if (!matchedProduct) {
      matchedProduct = allProducts.find(
        (p) => p.name.toLowerCase() === query
      );
    }

    // 4. StartsWith product name match
    if (!matchedProduct) {
      matchedProduct = allProducts.find(
        (p) => p.name.toLowerCase().startsWith(query)
      );
    }

    // 5. Partial product name match
    if (!matchedProduct) {
      matchedProduct = allProducts.find(
        (p) => p.name.toLowerCase().includes(query)
      );
    }

    if (!matchedProduct) {
      toast({
        title: "Product Not Found",
        description: `No product matching "${rawInput}". You can tap from Quick-Pick or type an unlisted item name below.`,
        variant: "destructive",
      });
      return;
    }

    addProductToBill(matchedProduct);
    setBarcodeScanInput("");
    setIsSearchFocused(false);
  };

  const processBarcodeScanned = (rawCode: string) => {
    processQuickSearchOrBarcode(rawCode);
  };

  const quickSearchSuggestions = React.useMemo(() => {
    const term = barcodeScanInput.trim().toLowerCase();
    if (!term) return [];
    return allProducts
      .filter((p) =>
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.sku && p.sku.toLowerCase().includes(term))
      )
      .slice(0, 6);
  }, [allProducts, barcodeScanInput]);

  const quickPickCategories = React.useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return ["All", ...Array.from(cats)];
  }, [allProducts]);

  const quickPickProducts = React.useMemo(() => {
    if (selectedQuickCategory === "All") {
      return allProducts.slice(0, 36);
    }
    return allProducts.filter((p) => p.category === selectedQuickCategory).slice(0, 36);
  }, [allProducts, selectedQuickCategory]);

  const getItemCartQuantity = React.useCallback(
    (productId: string) => {
      const found = (currentWatchedItems || []).find((item) => item.productId === productId);
      return found ? Number(found.quantitySold) || 0 : 0;
    },
    [currentWatchedItems]
  );

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (quickSearchSuggestions.length > 0) {
        addProductToBill(quickSearchSuggestions[0]);
        setBarcodeScanInput("");
        setIsSearchFocused(false);
      } else {
        processQuickSearchOrBarcode(barcodeScanInput);
      }
    } else if (e.key === "Escape") {
      setIsSearchFocused(false);
    }
  };

  const incrementQty = (index: number) => {
    const current = Number(form.getValues(`items.${index}.quantitySold`)) || 0;
    form.setValue(`items.${index}.quantitySold`, current + 1, { shouldDirty: true, shouldValidate: true });
  };

  const decrementQty = (index: number) => {
    const current = Number(form.getValues(`items.${index}.quantitySold`)) || 0;
    if (current > 1) {
      form.setValue(`items.${index}.quantitySold`, current - 1, { shouldDirty: true, shouldValidate: true });
    }
  };

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === "F8") {
        e.preventDefault();
        handleAddItem();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        form.handleSubmit(onSubmit)();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [form, onSubmit]);
  
  const handleProductSelectInternal = (itemIndex: number, productIdToSelect: string) => {
    const product = allProducts.find(p => p.id === productIdToSelect);
    if (product) {
        if (product.quantityInStock === 0) {
            toast({ title: "Out of Stock", description: `${product.name} is out of stock. Cannot select.`, variant: "destructive" });
            return;
        }
        form.setValue(`items.${itemIndex}.productId`, product.id, { shouldDirty: true });
        // Set unit and price together
        handleSoldUnitChange(itemIndex, product.baseUnit, product);
        
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
    
    let finalDiscountAmount = 0;
    const isWholesale = (data.saleType || 'wholesale') === 'wholesale';
    if (!isWholesale) {
      const discountVal = Number(data.discountValue) || 0;
      if (discountVal > 0) {
        if (data.discountType === 'percentage') {
          finalDiscountAmount = parseFloat(((finalItemsTotal * discountVal) / 100).toFixed(2));
        } else {
          finalDiscountAmount = parseFloat(discountVal.toFixed(2));
        }
      }
      finalDiscountAmount = Math.min(finalItemsTotal, finalDiscountAmount);
    }

    const finalGrandTotalForSubmission = parseFloat(
      Math.max(0, finalItemsTotal - finalDiscountAmount + finalPackagingCharges + finalTransportCharges).toFixed(2)
    );

    const finalAmountPaid = Number(data.amountPaid) || 0;

    if (finalAmountPaid > finalGrandTotalForSubmission + 0.001) {
        form.setError("amountPaid", {message: "Amount paid cannot exceed the grand total."});
        toast({title: "Validation Error", description: `Amount paid (Rs. ${finalAmountPaid.toFixed(2)}) cannot exceed the grand total (Rs. ${finalGrandTotalForSubmission.toFixed(2)}).`, variant: "destructive"});
        return;
    }

    const payload: RecordSaleActionPayload = {
      saleType: data.saleType || 'wholesale',
      saleDate: data.saleDate,
      customerId: data.customerId || undefined,
      customerName: data.customerName || undefined,
      customerPhone: data.customerPhone || undefined,
      notes: data.notes || undefined,
      paymentMethod: data.paymentMethod,
      items: itemsForAction,
      packagingCharges: finalPackagingCharges > 0 ? finalPackagingCharges : undefined,
      transportCharges: finalTransportCharges > 0 ? finalTransportCharges : undefined,
      discountType: isWholesale ? undefined : (data.discountType || 'fixed'),
      discountValue: isWholesale ? 0 : (data.discountValue || 0),
      discountAmount: isWholesale ? undefined : (finalDiscountAmount > 0 ? finalDiscountAmount : undefined),
      totalAmount: finalGrandTotalForSubmission,
      amountPaid: finalAmountPaid,
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

  const handleSoldUnitChange = (itemIndex: number, newSoldUnit: ProductUnit, productData?: Product) => {
    form.setValue(`items.${itemIndex}.soldUnit`, newSoldUnit, { shouldDirty: true });
    
    // If productData is not passed, find it. This happens when called from the select's onValueChange.
    const product = productData || allProducts.find(p => p.id === form.getValues(`items.${itemIndex}.productId`));

    if (product) {
        const currentSaleType = form.getValues("saleType") || 'wholesale';
        const basePrice = currentSaleType === 'retail'
          ? (product.retailPricePerBaseUnit || product.wholesalePricePerBaseUnit || 0)
          : (product.wholesalePricePerBaseUnit || 0);

        let pricePerSoldUnit = basePrice;
        if (newSoldUnit === product.purchaseUnit && product.purchaseUnit !== product.baseUnit && product.purchaseUnitConversionFactor && product.purchaseUnitConversionFactor > 0) {
            pricePerSoldUnit = basePrice * product.purchaseUnitConversionFactor;
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
    if (currentUserRole === 'staff') {
        quickAddForm.setValue("purchasePrice", 0);
    }

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
        toast({ title: "Product Added", description: `${result.product.name} added to inventory (Purchase Price: Rs. ${result.product.purchasePrice.toFixed(2)}). Stock is 0.` });
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

  const memoizedFilteredProducts = React.useMemo(() => {
    return itemSearchTexts.map(searchText => {
        if (!searchText) return allProducts.slice(0, 10);
        const lowercasedSearchText = searchText.toLowerCase().trim();
        return allProducts
            .filter(p => 
                p.name.toLowerCase().includes(lowercasedSearchText) ||
                (p.sku && p.sku.toLowerCase().includes(lowercasedSearchText)) ||
                (p.barcode && p.barcode.toLowerCase().includes(lowercasedSearchText))
            )
            .slice(0, 15);
    });
  }, [itemSearchTexts, allProducts]);


  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Top Billing Mode Bar: Wholesale vs Retail */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:px-4 bg-card border rounded-xl shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bill Mode:</span>
              <div className="inline-flex items-center p-1 bg-muted/80 rounded-lg border gap-1">
                <button
                  type="button"
                  onClick={() => handleSaleTypeChange('wholesale')}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    watchedSaleType === 'wholesale'
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  🏢 Wholesale Bill
                </button>
                <button
                  type="button"
                  onClick={() => handleSaleTypeChange('retail')}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                    watchedSaleType === 'retail'
                      ? "bg-primary text-primary-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  🛍️ Retail Bill
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={watchedSaleType === 'wholesale' ? "default" : "secondary"} className="gap-1 font-semibold text-xs">
                {watchedSaleType === 'wholesale' ? "Wholesale Rates Active" : "Retail Rates Active"}
              </Badge>
              <span className="text-xs text-muted-foreground hidden md:inline">• Product rates auto-adjust on switch</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* ================= LEFT COLUMN: Items & Barcode Scanner ================= */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="p-4 sm:p-5 pb-3 border-b">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
                          Items on Bill ({fields.length})
                        </CardTitle>
                        <Button
                          type="button"
                          variant={showQuickPickGrid ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs gap-1 font-medium"
                          onClick={() => setShowQuickPickGrid(!showQuickPickGrid)}
                        >
                          <LayoutGrid className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">⚡ Quick-Pick Items</span>
                          <span className="sm:hidden">⚡ Quick-Pick</span>
                          {showQuickPickGrid ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Tap Quick-Pick items, type name to search, or scan barcode (optional).
                      </CardDescription>
                    </div>

                    {/* Universal Search & Barcode Scan Bar with Real-time Suggestions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-80">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          ref={barcodeInputRef}
                          placeholder="Type item name, SKU, or scan..."
                          className="pl-8 pr-10 bg-background border-primary/40 focus-visible:ring-primary h-9 text-base sm:text-sm"
                          value={barcodeScanInput}
                          onChange={(e) => {
                            setBarcodeScanInput(e.target.value);
                            setIsSearchFocused(true);
                          }}
                          onFocus={() => setIsSearchFocused(true)}
                          onBlur={() => {
                            setTimeout(() => setIsSearchFocused(false), 200);
                          }}
                          onKeyDown={handleBarcodeKeyDown}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => setIsCameraScannerOpen(true)}
                          title="Open Camera Scanner (Phone / Tablet)"
                        >
                          <Camera className="h-4 w-4" />
                        </Button>

                        {/* Real-time Search Autocomplete Dropdown */}
                        {isSearchFocused && quickSearchSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 bg-popover text-popover-foreground border rounded-lg shadow-xl z-50 overflow-hidden divide-y divide-border/60">
                            <div className="p-1.5 bg-muted/40 text-[11px] font-semibold text-muted-foreground flex justify-between items-center px-3">
                              <span>Matching Products ({quickSearchSuggestions.length})</span>
                              <span className="text-[10px] text-primary">Enter or Tap to Add</span>
                            </div>
                            {quickSearchSuggestions.map((prod) => (
                              <button
                                key={prod.id}
                                type="button"
                                className="w-full px-3 py-2 text-left hover:bg-accent/60 flex items-center justify-between gap-3 text-xs transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addProductToBill(prod);
                                  setBarcodeScanInput("");
                                  setIsSearchFocused(false);
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground">{prod.name}</span>
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span>Stock: {prod.quantityInStock} {prod.baseUnit}</span>
                                    {prod.barcode && <span className="font-mono text-primary bg-primary/10 px-1 rounded text-[10px]">BAR: {prod.barcode}</span>}
                                    {prod.sku && <span className="font-mono bg-muted px-1 rounded text-[10px]">SKU: {prod.sku}</span>}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-bold text-primary text-xs">
                                    Rs. {watchedSaleType === 'retail' ? (prod.retailPricePerBaseUnit || prod.wholesalePricePerBaseUnit) : prod.wholesalePricePerBaseUnit}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground block">/{prod.baseUnit}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-3 sm:p-5 space-y-3">
                  {/* Collapsible Quick-Pick Products Panel */}
                  {showQuickPickGrid && (
                    <div className="border rounded-lg bg-card/60 overflow-hidden mb-3">
                      <div className="flex items-center justify-between p-2.5 bg-muted/30 border-b">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold">⚡ Quick-Pick Products</span>
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                            {allProducts.length} in inventory
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground hidden sm:inline">
                          Tap any item to add to bill
                        </span>
                      </div>

                      <div className="p-2.5 space-y-2">
                        {/* Category filter pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                          {quickPickCategories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedQuickCategory(cat)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                                selectedQuickCategory === cat
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                  : "bg-background text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        {/* Product Cards Grid */}
                        {quickPickProducts.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">No products in this category.</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 pr-1.5">
                            {quickPickProducts.map((product) => {
                              const inCartQty = getItemCartQuantity(product.id);
                              const isOutOfStock = product.quantityInStock <= 0;

                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() => addProductToBill(product)}
                                  className={cn(
                                    "group relative p-2 rounded-lg border text-left flex flex-col justify-between transition-all duration-150 active:scale-95",
                                    isOutOfStock
                                      ? "opacity-50 cursor-not-allowed bg-muted/40 border-muted"
                                      : inCartQty > 0
                                        ? "bg-primary/5 border-primary/60 shadow-xs ring-1 ring-primary/20"
                                        : "bg-background hover:bg-muted/50 hover:border-primary/40 border-border"
                                  )}
                                >
                                  {inCartQty > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center shadow-xs">
                                      {inCartQty}
                                    </span>
                                  )}
                                  <div>
                                    <span className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                      {product.name}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block line-clamp-1">
                                      {product.category || 'General'}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between text-xs pt-1 border-t border-border/40">
                                    <span className="font-bold text-foreground">
                                      Rs. {watchedSaleType === 'retail' ? (product.retailPricePerBaseUnit || product.wholesalePricePerBaseUnit) : product.wholesalePricePerBaseUnit}
                                    </span>
                                    <span className={cn(
                                      "text-[10px]",
                                      isOutOfStock ? "text-destructive font-semibold" : product.quantityInStock <= 5 ? "text-amber-600 font-medium" : "text-muted-foreground"
                                    )}>
                                      {isOutOfStock ? "Out" : `${product.quantityInStock} ${product.baseUnit}`}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                    const filteredProductList = memoizedFilteredProducts[index];

                    return (
                      <div
                        key={fieldItem.id}
                        className="rounded-lg border p-3 sm:p-4 bg-muted/20 space-y-3 hover:border-primary/40 transition-colors"
                      >
                        {/* Top: Product search/combobox + Delete */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <Popover open={openComboboxIndex === index} onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between h-10 text-left font-normal text-base sm:text-sm",
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
                                    placeholder="Search product by name, SKU, or barcode..."
                                    value={itemSearchTexts[index]}
                                    onValueChange={(searchValue) => handleProductSearchInputChange(index, searchValue)}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {itemSearchTexts[index]?.trim() !== "" ? "No product found. Type full name to add as unlisted item." : "Start typing..."}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {filteredProductList.map((product) => (
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
                                          <div className="flex flex-col text-left">
                                            <span className="font-medium text-foreground">{product.name}</span>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <span>Stock: {product.quantityInStock} {product.baseUnit}</span>
                                              {product.sku && <span className="font-mono bg-muted px-1 rounded">SKU: {product.sku}</span>}
                                              {product.barcode && <span className="font-mono bg-primary/10 text-primary px-1 rounded">BAR: {product.barcode}</span>}
                                            </div>
                                          </div>
                                          {product.quantityInStock === 0 && <span className="ml-auto text-xs text-destructive font-semibold">Out of Stock</span>}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage>{form.formState.errors.items?.[index]?.productId?.message}</FormMessage>
                          </div>

                          {isAdHocItem && (
                            <Button type="button" variant="outline" size="sm" onClick={() => openQuickAddModal(index)} className="h-10 shrink-0 text-xs">
                              <PlusCircle className="h-4 w-4 mr-1" /> Add
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleRemoveItem(index)}
                            disabled={fields.length <= 1}
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Bottom Row: Quantity Steppers, Unit, Rate & Line Total */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-end">
                          {/* Quantity with Touch Stepper */}
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Quantity</FormLabel>
                            <div className="flex items-center mt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-9 rounded-r-none border-r-0 shrink-0 font-bold"
                                onClick={() => decrementQty(index)}
                                disabled={(Number(currentWatchedItems[index]?.quantitySold) || 0) <= 1}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <FormField
                                control={form.control}
                                name={`items.${index}.quantitySold`}
                                render={({ field }) => (
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    className="h-10 text-center rounded-none font-semibold text-base sm:text-sm w-full min-w-12 px-1"
                                    placeholder="1"
                                    min="1"
                                    {...field}
                                    onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                                  />
                                )}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-9 rounded-l-none border-l-0 shrink-0 font-bold"
                                onClick={() => incrementQty(index)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Unit Selector */}
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Unit</FormLabel>
                            <FormField
                              control={form.control}
                              name={`items.${index}.soldUnit`}
                              render={({ field }) => (
                                <Select
                                  onValueChange={(value) => handleSoldUnitChange(index, value as ProductUnit)}
                                  value={field.value}
                                  disabled={availableUnits.length === 0 && !currentProductId && !itemSearchTexts[index]?.trim()}
                                >
                                  <SelectTrigger className="h-10 mt-1 text-base sm:text-sm">
                                    <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableUnits.map(unit => (
                                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                    {isAdHocItem && !availableUnits.includes(field.value) && PRODUCT_UNITS.filter(u => !availableUnits.includes(u)).map(u => (
                                      <SelectItem key={`adhoc-${u}`} value={u}>{u}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>

                          {/* Rate / Unit (Rs.) */}
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Rate (Rs.)</FormLabel>
                            <FormField
                              control={form.control}
                              name={`items.${index}.pricePerUnitSold`}
                              render={({ field }) => (
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="h-10 mt-1 font-medium text-base sm:text-sm"
                                  {...field}
                                  onChange={e => field.onChange(e.target.value)}
                                />
                              )}
                            />
                          </div>

                          {/* Line Total */}
                          <div>
                            <FormLabel className="text-xs text-muted-foreground">Line Total</FormLabel>
                            <div className="h-10 mt-1 flex items-center justify-end px-3 rounded-md bg-muted/40 font-bold text-foreground text-sm border">
                              Rs. {((Number(currentWatchedItems[index]?.quantitySold) || 0) * (Number(currentWatchedItems[index]?.pricePerUnitSold) || 0)).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-dashed mt-2 gap-2 text-primary font-medium hover:bg-primary/5"
                    onClick={handleAddItem}
                  >
                    <PlusCircle className="h-4 w-4" /> Add Item (F8)
                  </Button>
                  <FormMessage>{form.formState.errors.items?.root?.message || form.formState.errors.items?.message}</FormMessage>
                </CardContent>
              </Card>
            </div>

            {/* ================= RIGHT COLUMN: Customer, Payment & Summary ================= */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
              
              {/* 1. Customer Profile Card */}
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <UserCircle className="h-4 w-4 text-primary" /> Customer Profile & Due
                    </CardTitle>
                    {selectedCustomer && (
                      <Badge variant={selectedCustomer.totalDue > 0 ? "destructive" : "secondary"}>
                        Due: Rs. {selectedCustomer.totalDue.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/20 text-xs">
                      <div>
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-primary" /> {selectedCustomer.name}
                          <Badge variant={selectedCustomer.customerType === 'retail' ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 h-4 capitalize font-semibold">
                            {selectedCustomer.customerType || 'wholesale'} customer
                          </Badge>
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {selectedCustomer.phone ? `Phone: ${selectedCustomer.phone} • ` : ""}
                          Due: <span className={selectedCustomer.totalDue > 0 ? "text-destructive font-semibold" : "text-green-600 font-semibold"}>Rs. {selectedCustomer.totalDue.toFixed(2)}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSelectedCustomer(null);
                          form.setValue("customerId", "");
                          form.setValue("customerName", "");
                          form.setValue("customerPhone", "");
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {allCustomers.length > 0 && (
                        <Popover open={isCustomerComboboxOpen} onOpenChange={setIsCustomerComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between font-normal text-muted-foreground h-9 text-xs"
                            >
                              <span className="truncate">{customerSearchText || "Search existing customer..."}</span>
                              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search customer name or phone..." value={customerSearchText} onValueChange={setCustomerSearchText} />
                              <CommandList>
                                <CommandEmpty>No matching customer found.</CommandEmpty>
                                <CommandGroup heading="Existing Customers">
                                  {allCustomers.map((cust) => (
                                    <CommandItem
                                      key={cust.id}
                                      value={`${cust.name} ${cust.phone || ""}`}
                                      onSelect={() => {
                                        setSelectedCustomer(cust);
                                        form.setValue("customerId", cust.id);
                                        form.setValue("customerName", cust.name);
                                        form.setValue("customerPhone", cust.phone || "");
                                        if (cust.customerType === 'wholesale' || cust.customerType === 'retail') {
                                          handleSaleTypeChange(cust.customerType);
                                        }
                                        setIsCustomerComboboxOpen(false);
                                        setCustomerSearchText("");
                                      }}
                                      className="flex justify-between items-center cursor-pointer"
                                    >
                                      <div>
                                        <p className="font-medium text-foreground flex items-center gap-1.5">
                                          {cust.name}
                                          {cust.customerType && (
                                            <span className={cn(
                                              "text-[9px] px-1 py-0.5 rounded uppercase font-bold",
                                              cust.customerType === 'retail' ? "bg-purple-500/15 text-purple-700 dark:text-purple-300" : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                            )}>
                                              {cust.customerType}
                                            </span>
                                          )}
                                        </p>
                                        {cust.phone && <p className="text-xs text-muted-foreground">{cust.phone}</p>}
                                      </div>
                                      <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", cust.totalDue > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
                                        {cust.totalDue > 0 ? `Due: Rs. ${cust.totalDue.toFixed(2)}` : "No Due"}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                Name {amountDue > 0.001 && <span className="text-destructive">*</span>}
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="Customer name" className="h-9 text-base sm:text-xs" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customerPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone number" className="h-9 text-base sm:text-xs" {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {amountDue > 0.001 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Unpaid Due: Rs. {amountDue.toFixed(2)}</p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          Will be tracked in customer profile.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Date & Payment Method Card */}
              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-4 grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="saleDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Sale Date</FormLabel>
                        <FormControl>
                          <Input type="date" className="h-9 text-base sm:text-xs" {...field} />
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
                        <FormLabel className="text-xs">Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-base sm:text-xs">
                              <SelectValue placeholder="Method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="online">Online / UPI</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 3. Discount & Additional Charges Card */}
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-primary" /> {watchedSaleType === 'retail' ? "Discount & Charges" : "Additional Charges"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  {/* Retail Discount: Only available in Retail billing */}
                  {watchedSaleType === 'retail' ? (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Retail Discount (Optional)</span>
                        <span className="text-[10px] text-primary font-medium">Retail Mode</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name="discountType"
                          render={({ field }) => (
                            <Select value={field.value || "fixed"} onValueChange={field.onChange}>
                              <SelectTrigger className="h-9 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                                <SelectItem value="percentage">Percent (%)</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="discountValue"
                          render={({ field }) => (
                            <Input
                              type="number"
                              inputMode="decimal"
                              placeholder="0"
                              className="h-9 flex-1 text-base sm:text-xs"
                              value={field.value === undefined || field.value === null ? "" : field.value}
                              onChange={(e) => {
                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                field.onChange(isNaN(val) ? 0 : val);
                              }}
                            />
                          )}
                        />
                      </div>
                      {discountAmount > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          Savings: -Rs. {discountAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <FormField
                      control={form.control}
                      name="packagingCharges"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Packaging (Rs.)</FormLabel>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            className="h-9 text-base sm:text-xs"
                            {...field}
                            onChange={e => field.onChange(e.target.value)}
                          />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="transportCharges"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Transport (Rs.)</FormLabel>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            className="h-9 text-base sm:text-xs"
                            {...field}
                            onChange={e => field.onChange(e.target.value)}
                          />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 4. Bill Summary & Checkout Card */}
              <Card className="border-primary/40 shadow-md bg-card">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-semibold">Bill Summary</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="space-y-1.5 text-xs text-muted-foreground border-b pb-2.5">
                    <div className="flex justify-between">
                      <span>Items Total:</span>
                      <span className="font-medium text-foreground">Rs. {itemsTotal.toFixed(2)}</span>
                    </div>
                    {watchedSaleType === 'retail' && discountAmount > 0 && (
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Discount ({watchedDiscountType === "percentage" ? `${watchedDiscountValue}%` : "Fixed"}):</span>
                        <span>-Rs. {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {(Number(watchedPackagingCharges) || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Packaging:</span>
                        <span>+Rs. {(Number(watchedPackagingCharges) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    {(Number(watchedTransportCharges) || 0) > 0 && (
                      <div className="flex justify-between">
                        <span>Transport:</span>
                        <span>+Rs. {(Number(watchedTransportCharges) || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-foreground pt-1.5 border-t">
                      <span>Grand Total:</span>
                      <span className="text-primary text-xl font-black">Rs. {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Amount Paid with Quick Fill Buttons */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-xs font-semibold">Amount Paid (Rs.)</FormLabel>
                      <span className={cn("text-xs font-bold", amountDue > 0.001 ? "text-destructive" : "text-green-600")}>
                        {amountDue > 0.001 ? `Due: Rs. ${amountDue.toFixed(2)}` : "Fully Paid"}
                      </span>
                    </div>
                    <FormField
                      control={form.control}
                      name="amountPaid"
                      render={({ field }) => (
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          className="h-10 text-base sm:text-sm font-bold"
                          placeholder="0.00"
                          {...field}
                          onChange={e => field.onChange(e.target.value)}
                        />
                      )}
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-200"
                        onClick={() => form.setValue("amountPaid", parseFloat(grandTotal.toFixed(2)), { shouldValidate: true, shouldDirty: true })}
                      >
                        Full Paid
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-7 text-xs bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-amber-200"
                        onClick={() => form.setValue("amountPaid", 0, { shouldValidate: true, shouldDirty: true })}
                      >
                        Add Due
                      </Button>
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <Input
                        placeholder="Optional bill notes..."
                        className="h-9 text-xs"
                        {...field}
                        value={field.value ?? ""}
                      />
                    )}
                  />

                  {/* Desktop Submit Button */}
                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                      className="w-full h-11 text-base font-semibold shadow-md gap-2"
                    >
                      {form.formState.isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Save className="h-5 w-5" />
                      )}
                      Record Sale & Print
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* ================= MOBILE STICKY BOTTOM CHECKOUT ACTION BAR (lg:hidden) ================= */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t p-3 px-4 shadow-2xl flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{fields.length} item{fields.length > 1 ? 's' : ''}</span>
              <span className="text-lg font-bold text-foreground">Rs. {grandTotal.toFixed(2)}</span>
              {amountDue > 0.001 && (
                <span className="text-[11px] font-semibold text-destructive">Due: Rs. {amountDue.toFixed(2)}</span>
              )}
            </div>

            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-11 px-6 font-semibold shadow-md gap-2"
            >
              {form.formState.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Bill
            </Button>
          </div>
        </form>
      </Form>

      {/* Camera Barcode Scanner Modal for Mobile / Tablets */}
      <CameraScannerDialog
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onBarcodeDetected={(code) => {
          processBarcodeScanned(code);
        }}
      />

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


export default function NewSalePage() {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = React.useState<SessionData['role'] | undefined>(undefined);


  const fetchProductsCustomersAndSession = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedProducts, fetchedCustomers, session] = await Promise.all([
        getProductsAction(),
        getCustomersAction(),
        getSession()
      ]);
      setProducts(fetchedProducts);
      setCustomers(fetchedCustomers);
      setCurrentUserRole(session?.role);
    } catch (e) {
      console.error("Failed to fetch products, customers, or session for new sale page:", e);
      setError(e instanceof Error ? e.message : "Failed to load initial data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProductsCustomersAndSession();
  }, [fetchProductsCustomersAndSession]);

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto w-full pb-20 lg:pb-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/sales">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Sales</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-headline">New Sale / Billing</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Fast POS & Invoicing for mobile, tablet, and desktop</p>
          </div>
        </div>
      </div>

      {isLoading && products.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-2">Loading products, customers, and session...</p>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center py-10 text-destructive">
             <p>{error}</p>
             <Button variant="outline" onClick={fetchProductsCustomersAndSession} className="mt-4">Try Again</Button>
          </div>
        </Card>
      ) : (
        <SaleForm allProducts={products} allCustomers={customers} onProductAdded={fetchProductsCustomersAndSession} currentUserRole={currentUserRole} />
      )}
      { !isLoading && !error && products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed p-6">
          <p>No products found in inventory. You can still sell items by typing their names directly and adding them.</p>
          <Button variant="default" asChild className="mt-4">
            <Link href="/products/new">Add Product to Inventory Manually</Link>
          </Button>
       </div>
      )}
    </div>
  );
}
