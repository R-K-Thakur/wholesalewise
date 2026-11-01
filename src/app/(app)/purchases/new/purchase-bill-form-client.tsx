'use client';

import * as React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  PlusCircle,
  Trash2,
  Loader2,
  Check,
  ChevronsUpDown,
  Truck,
  AlertCircle,
  Building2,
  Package,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/types';
import { PRODUCT_UNITS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { purchaseBillFormSchema, type PurchaseBillFormValues } from '../schema';
import { recordPurchaseBillAction } from '../actions';

interface PurchaseBillFormClientProps {
  products: Product[];
  existingSuppliers: string[];
  userRole?: string;
}

export function PurchaseBillFormClient({
  products: initialProducts,
  existingSuppliers,
  userRole,
}: PurchaseBillFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [openComboboxIndex, setOpenComboboxIndex] = React.useState<number | null>(null);

  const form = useForm<PurchaseBillFormValues>({
    resolver: zodResolver(purchaseBillFormSchema),
    defaultValues: {
      supplierName: '',
      supplierPhone: '',
      invoiceNumber: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      items: [
        {
          productId: '',
          quantityPurchased: 1,
          purchasePricePerUnit: 0,
          purchaseUnit: PRODUCT_UNITS[0],
        },
      ],
      paymentMethod: 'cash',
      amountPaid: 0,
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedItems = form.watch('items');
  const watchedAmountPaid = form.watch('amountPaid');

  // Compute total bill amount
  const billTotal = React.useMemo(() => {
    return (watchedItems || []).reduce((sum, item) => {
      const qty = Number(item?.quantityPurchased) || 0;
      const price = Number(item?.purchasePricePerUnit) || 0;
      return sum + qty * price;
    }, 0);
  }, [watchedItems]);

  const roundedTotal = parseFloat(billTotal.toFixed(2));

  // Sync default amount paid with bill total unless user altered it
  React.useEffect(() => {
    const isAmountPaidDirty = form.getFieldState('amountPaid').isDirty;
    if (!isAmountPaidDirty) {
      form.setValue('amountPaid', roundedTotal, { shouldValidate: true, shouldDirty: false });
    }
  }, [roundedTotal, form]);

  const amountPaidValue = Number(watchedAmountPaid) || 0;
  const supplierDue = parseFloat(Math.max(0, roundedTotal - amountPaidValue).toFixed(2));

  const handleProductSelect = (index: number, selectedProduct: Product) => {
    form.setValue(`items.${index}.productId`, selectedProduct.id, { shouldValidate: true });
    form.setValue(`items.${index}.purchaseUnit`, selectedProduct.purchaseUnit, { shouldValidate: true });
    form.setValue(`items.${index}.purchasePricePerUnit`, selectedProduct.purchasePrice || 0, { shouldValidate: true });
    setOpenComboboxIndex(null);
  };

  const onSubmit = async (values: PurchaseBillFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await recordPurchaseBillAction(values);
      if (res.success) {
        toast({
          title: 'Purchase Recorded!',
          description: res.message,
        });
        router.push(res.billId ? `/purchases/${res.billId}` : '/purchases');
      } else {
        toast({
          title: 'Failed to record purchase',
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="p-0 h-auto text-muted-foreground hover:text-foreground">
              <Link href="/purchases">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Purchases
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" /> Record Inward Purchase
          </h1>
          <p className="text-sm text-muted-foreground">
            Inward stock from suppliers. Product quantities will increase automatically.
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Supplier & Bill Details Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" /> Supplier & Invoice Details
              </CardTitle>
              <CardDescription>Enter the supplier name and their invoice/bill number.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Supplier / Vendor Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Mahavir Distributors, ABC Traders"
                        {...field}
                        list="supplier-suggestions"
                      />
                    </FormControl>
                    {existingSuppliers.length > 0 && (
                      <datalist id="supplier-suggestions">
                        {existingSuppliers.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Bill / Invoice #</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. INV-2024-889" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierPhone"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Supplier Contact Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g. +91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes / Order Remarks</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Batch #4, delivered by transporter XYZ" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Items Inward Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" /> Inward Items
                </CardTitle>
                <CardDescription>Select products and enter quantity and purchase price per unit.</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    productId: '',
                    quantityPurchased: 1,
                    purchasePricePerUnit: 0,
                    purchaseUnit: PRODUCT_UNITS[0],
                  })
                }
              >
                <PlusCircle className="h-4 w-4 mr-1" /> Add Product Line
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="hidden md:grid md:grid-cols-12 gap-3 text-xs font-semibold text-muted-foreground px-2">
                <div className="col-span-5">Product</div>
                <div className="col-span-2">Quantity</div>
                <div className="col-span-2">Purchase Unit</div>
                <div className="col-span-2">Unit Price (Rs.)</div>
                <div className="col-span-1 text-right">Total</div>
              </div>

              {fields.map((fieldItem, index) => {
                const currentItem = watchedItems[index] || {};
                const selectedProd = products.find((p) => p.id === currentItem.productId);
                const lineTotal =
                  (Number(currentItem.quantityPurchased) || 0) * (Number(currentItem.purchasePricePerUnit) || 0);

                return (
                  <div
                    key={fieldItem.id}
                    className="p-3 border rounded-lg bg-card/60 flex flex-col md:grid md:grid-cols-12 gap-3 items-center"
                  >
                    {/* Product Selection */}
                    <div className="w-full md:col-span-5">
                      <FormField
                        control={form.control}
                        name={`items.${index}.productId`}
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <Popover
                              open={openComboboxIndex === index}
                              onOpenChange={(isOpen) => setOpenComboboxIndex(isOpen ? index : null)}
                            >
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      'w-full justify-between font-normal text-left truncate',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    <span className="truncate">
                                      {field.value
                                        ? products.find((p) => p.id === field.value)?.name || 'Select product'
                                        : 'Search / Select Product...'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[320px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search product name..." />
                                  <CommandList>
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup>
                                      {products.map((p) => (
                                        <CommandItem
                                          key={p.id}
                                          value={p.name}
                                          onSelect={() => handleProductSelect(index, p)}
                                        >
                                          <Check
                                            className={cn(
                                              'mr-2 h-4 w-4',
                                              p.id === field.value ? 'opacity-100' : 'opacity-0'
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{p.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              Stock: {p.quantityInStock} {p.baseUnit} | Buy Price: Rs. {p.purchasePrice}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {selectedProd && (
                              <p className="text-xs text-muted-foreground">
                                Current stock: {selectedProd.quantityInStock} {selectedProd.baseUnit}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="w-full md:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantityPurchased`}
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                min="0.01"
                                placeholder="Qty"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Purchase Unit */}
                    <div className="w-full md:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.purchaseUnit`}
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PRODUCT_UNITS.map((u) => (
                                  <SelectItem key={u} value={u}>
                                    {u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="w-full md:col-span-2">
                      <FormField
                        control={form.control}
                        name={`items.${index}.purchasePricePerUnit`}
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="Cost/unit"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Total & Delete Button */}
                    <div className="w-full md:col-span-1 flex items-center justify-between md:justify-end gap-2">
                      <div className="text-right font-medium text-sm">
                        Rs. {lineTotal.toFixed(2)}
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Payment & Totals Summary Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Payment & Settlement</CardTitle>
              <CardDescription>Specify the payment made and track any pending supplier credit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Mode *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer / NEFT</SelectItem>
                          <SelectItem value="upi">UPI / Online</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="credit">Supplier Credit (Pay Later)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid Now (Rs.) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="p-4 rounded-lg bg-muted/60 flex flex-col justify-center">
                  <span className="text-xs text-muted-foreground font-medium">Grand Inward Total</span>
                  <span className="text-2xl font-bold font-headline">
                    Rs. {roundedTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {supplierDue > 0.001 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                        Supplier Payable / Due Recorded
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                        Remaining Rs. {supplierDue.toFixed(2)} will be recorded as pending due to {form.watch('supplierName') || 'this supplier'}.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-amber-700 border-amber-500 font-bold">
                    Pending Due: Rs. {supplierDue.toFixed(2)}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" asChild disabled={isSubmitting}>
              <Link href="/purchases">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting || fields.length === 0} className="min-w-[180px]">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording Stock In...
                </>
              ) : (
                <>
                  <Truck className="mr-2 h-4 w-4" /> Save & Inward Stock
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
