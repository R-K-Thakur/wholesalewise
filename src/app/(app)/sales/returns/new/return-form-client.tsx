"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RotateCcw,
  Package,
  User,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  BadgeAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Sale, SaleReturn, ReturnItemCondition, ReturnRefundMethod } from "@/lib/types";
import { returnReasonOptions } from "../schema";
import { recordSaleReturnAction } from "../actions";

interface ReturnFormClientProps {
  initialSale: Sale | null;
  allSales: Sale[];
  previousReturnsForSale: SaleReturn[];
}

interface ReturnItemRow {
  productId?: string;
  productNameSnapshot: string;
  unit: string;
  originalQty: number;
  previouslyReturnedQty: number;
  maxReturnable: number;
  pricePerUnit: number;
  selected: boolean;
  returnQty: number;
  condition: ReturnItemCondition;
}

export function ReturnFormClient({
  initialSale,
  allSales,
  previousReturnsForSale,
}: ReturnFormClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedSaleId, setSelectedSaleId] = React.useState<string>(initialSale?.id || "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Selected Sale Object
  const currentSale = React.useMemo(() => {
    return allSales.find((s) => s.id === selectedSaleId) || initialSale;
  }, [allSales, selectedSaleId, initialSale]);

  // Form Fields
  const [refundMethod, setRefundMethod] = React.useState<ReturnRefundMethod>(
    currentSale?.totalAmountDue && currentSale.totalAmountDue > 0 ? "deduct_customer_due" : "cash"
  );
  const [returnReason, setReturnReason] = React.useState(returnReasonOptions[0]);
  const [customReason, setCustomReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [returnDate, setReturnDate] = React.useState(new Date().toISOString().split("T")[0]);

  // Items State
  const [itemRows, setItemRows] = React.useState<ReturnItemRow[]>([]);

  // Initialize Item Rows when selected sale changes
  React.useEffect(() => {
    if (!currentSale) {
      setItemRows([]);
      return;
    }

    // Map previously returned quantities
    const alreadyReturnedMap = new Map<string, number>();
    for (const ret of previousReturnsForSale) {
      for (const item of ret.items) {
        const key = item.productId || item.productNameSnapshot;
        alreadyReturnedMap.set(key, (alreadyReturnedMap.get(key) || 0) + item.quantityReturned);
      }
    }

    const rows: ReturnItemRow[] = (currentSale.items || []).map((item) => {
      const key = item.productId || item.productNameSnapshot;
      const previouslyReturned = alreadyReturnedMap.get(key) || 0;
      const maxReturnable = Math.max(0, parseFloat((item.quantitySold - previouslyReturned).toFixed(4)));

      return {
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        unit: item.soldUnit,
        originalQty: item.quantitySold,
        previouslyReturnedQty: previouslyReturned,
        maxReturnable,
        pricePerUnit: item.pricePerUnitSold,
        selected: maxReturnable > 0,
        returnQty: maxReturnable > 0 ? maxReturnable : 0,
        condition: "resellable",
      };
    });

    setItemRows(rows);
  }, [currentSale, previousReturnsForSale]);

  // Totals calculations
  const selectedItemsToReturn = React.useMemo(() => {
    return itemRows.filter((r) => r.selected && r.returnQty > 0);
  }, [itemRows]);

  const totalRefundAmount = React.useMemo(() => {
    return selectedItemsToReturn.reduce(
      (sum, r) => sum + parseFloat((r.returnQty * r.pricePerUnit).toFixed(2)),
      0
    );
  }, [selectedItemsToReturn]);

  const totalUnitsToReturn = React.useMemo(() => {
    return selectedItemsToReturn.reduce((sum, r) => sum + r.returnQty, 0);
  }, [selectedItemsToReturn]);

  const handleRowCheckbox = (index: number, checked: boolean) => {
    setItemRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        selected: checked,
        returnQty: checked && updated[index].returnQty === 0 ? updated[index].maxReturnable : updated[index].returnQty,
      };
      return updated;
    });
  };

  const handleQuantityChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setItemRows((prev) => {
      const updated = [...prev];
      const max = updated[index].maxReturnable;
      updated[index] = {
        ...updated[index],
        returnQty: num > max ? max : num,
        selected: num > 0 ? true : updated[index].selected,
      };
      return updated;
    });
  };

  const handleConditionChange = (index: number, condition: ReturnItemCondition) => {
    setItemRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        condition,
      };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentSale) {
      toast({ title: "Sale Required", description: "Please select an invoice to return items from.", variant: "destructive" });
      return;
    }

    if (selectedItemsToReturn.length === 0) {
      toast({ title: "No Items Selected", description: "Please select at least one item with a quantity to return.", variant: "destructive" });
      return;
    }

    const finalReason = returnReason === "Other reason" && customReason.trim() ? customReason.trim() : returnReason;

    setIsSubmitting(true);
    try {
      const res = await recordSaleReturnAction({
        saleId: currentSale.id,
        items: selectedItemsToReturn.map((r) => ({
          productId: r.productId,
          productNameSnapshot: r.productNameSnapshot,
          quantityReturned: r.returnQty,
          unit: r.unit as any,
          pricePerUnit: r.pricePerUnit,
          condition: r.condition,
        })),
        refundMethod,
        returnReason: finalReason,
        notes: notes.trim(),
        returnDate,
      });

      if (res.success && res.returnId) {
        toast({
          title: "Return Processed!",
          description: `Credit Note / Return #${res.returnNumber} recorded successfully.`,
        });
        router.push(`/sales/returns/${res.returnId}`);
      } else {
        toast({
          title: "Return Failed",
          description: res.message || "Failed to process return.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground mb-1">
            <Link href={currentSale ? `/sales/${currentSale.id}` : "/sales/returns"}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" /> Process Sales Return & Credit Note
          </h1>
          <p className="text-sm text-muted-foreground">
            Issue customer credit note, refund cash, and restore resellable items to warehouse inventory.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sale Invoice Selection Card */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">1. Original Sale Invoice</CardTitle>
            <CardDescription>Select the invoice from which goods are being returned</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Invoice / Bill Number</Label>
              <Select value={selectedSaleId} onValueChange={setSelectedSaleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select sale invoice..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {allSales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono font-medium">#{s.id.slice(0, 8)}</span> •{" "}
                      <span className="font-medium">{s.customerName || "Walk-in Customer"}</span> •{" "}
                      <span>Rs. {s.totalAmount.toFixed(2)}</span> •{" "}
                      <span className="text-muted-foreground">{s.saleDate}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Details Banner */}
            {currentSale && (
              <div className="p-4 rounded-lg border bg-muted/20 text-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block">Customer</span>
                  <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-primary" /> {currentSale.customerName || "Walk-in"}
                  </span>
                  {currentSale.customerPhone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {currentSale.customerPhone}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Invoice Date</span>
                  <span className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {currentSale.saleDate}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Total Bill Amount</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    Rs. {currentSale.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Current Outstanding Due</span>
                  <span
                    className={`font-semibold mt-0.5 block ${
                      currentSale.totalAmountDue > 0 ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    Rs. {(currentSale.totalAmountDue || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Return Items Selection */}
        {currentSale && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">2. Select Items to Return</CardTitle>
              <CardDescription>
                Specify the returned quantity and product condition for restock or waste write-off.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-y">
                    <tr>
                      <th scope="col" className="px-4 py-3 w-10">Select</th>
                      <th scope="col" className="px-4 py-3">Item Description</th>
                      <th scope="col" className="px-4 py-3 text-center">Sold Qty</th>
                      <th scope="col" className="px-4 py-3 text-center">Prev. Returned</th>
                      <th scope="col" className="px-4 py-3 text-center">Max Returnable</th>
                      <th scope="col" className="px-4 py-3 text-right">Price (Rs.)</th>
                      <th scope="col" className="px-4 py-3 w-28">Return Qty</th>
                      <th scope="col" className="px-4 py-3 w-44">Condition</th>
                      <th scope="col" className="px-4 py-3 text-right">Refund (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {itemRows.map((row, idx) => {
                      const rowRefund = parseFloat((row.returnQty * row.pricePerUnit).toFixed(2));
                      const isDisabled = row.maxReturnable <= 0;

                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-muted/20 transition-colors ${
                            row.selected ? "bg-primary/5" : ""
                          } ${isDisabled ? "opacity-50" : ""}`}
                        >
                          <td className="px-4 py-3 text-center">
                            <Checkbox
                              checked={row.selected}
                              disabled={isDisabled}
                              onCheckedChange={(checked) => handleRowCheckbox(idx, Boolean(checked))}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.productNameSnapshot}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {row.originalQty} {row.unit}
                          </td>
                          <td className="px-4 py-3 text-center text-muted-foreground">
                            {row.previouslyReturnedQty > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                {row.previouslyReturnedQty} {row.unit}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-center font-medium">
                            {row.maxReturnable} {row.unit}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {row.pricePerUnit.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              max={row.maxReturnable}
                              disabled={!row.selected || isDisabled}
                              value={row.returnQty || ""}
                              onChange={(e) => handleQuantityChange(idx, e.target.value)}
                              className="h-8 text-right font-medium"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={row.condition}
                              disabled={!row.selected || isDisabled}
                              onValueChange={(val: ReturnItemCondition) => handleConditionChange(idx, val)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="resellable">
                                  <span className="text-emerald-600 font-medium">Resellable (Restock)</span>
                                </SelectItem>
                                <SelectItem value="damaged">
                                  <span className="text-destructive font-medium">Damaged (Scrap)</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground">
                            Rs. {row.selected ? rowRefund.toFixed(2) : "0.00"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Return Details & Refund Action */}
        {currentSale && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">3. Return Reason & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Return Reason *</Label>
                  <Select value={returnReason} onValueChange={setReturnReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnReasonOptions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {returnReason === "Other reason" && (
                  <div className="space-y-1.5">
                    <Label>Specify Reason *</Label>
                    <Input
                      placeholder="Please specify why items are returned..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Return Date</Label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Internal Notes (Optional)</Label>
                  <Input
                    placeholder="Inspection findings, manager approval, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm flex flex-col justify-between">
              <div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">4. Refund / Credit Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Settlement Type *</Label>
                    <Select value={refundMethod} onValueChange={(val: ReturnRefundMethod) => setRefundMethod(val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deduct_customer_due">
                          Deduct from Customer Due (Credit Note)
                        </SelectItem>
                        <SelectItem value="cash">
                          Cash Refund
                        </SelectItem>
                        <SelectItem value="store_credit">
                          Store Credit (Future Purchases)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {refundMethod === "deduct_customer_due" && currentSale.customerId && (
                    <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                      <p className="font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Credit Note will be applied to profile
                      </p>
                      <p>
                        This will deduct Rs. {totalRefundAmount.toFixed(2)} from {currentSale.customerName}&apos;s outstanding balance and log a credit transaction in their profile ledger.
                      </p>
                    </div>
                  )}

                  {/* Summary Callout */}
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-2 mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Total Units to Return:</span>
                      <span className="font-medium text-foreground">{totalUnitsToReturn} units</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Selected Items:</span>
                      <span className="font-medium text-foreground">{selectedItemsToReturn.length} items</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-2 border-t text-foreground">
                      <span>Total Credit / Refund:</span>
                      <span className="text-primary text-xl font-bold">
                        Rs. {totalRefundAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </div>

              <div className="p-6 pt-0">
                <Button
                  type="submit"
                  disabled={isSubmitting || selectedItemsToReturn.length === 0}
                  className="w-full gap-2 h-11 text-base shadow-sm"
                >
                  <RotateCcw className="h-5 w-5" />
                  {isSubmitting ? "Processing Return..." : `Confirm Return & Issue Credit Note (Rs. ${totalRefundAmount.toFixed(2)})`}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </form>
    </div>
  );
}
