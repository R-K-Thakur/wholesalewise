"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PlusCircle,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Trash2,
  Search,
  SlidersHorizontal,
  Package,
  Layers,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Calendar,
  User,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { InventoryAdjustment, Product, InventoryAdjustmentType } from "@/lib/types";
import { adjustmentTypeOptions } from "./schema";
import { recordInventoryAdjustmentAction, deleteInventoryAdjustmentAction } from "./actions";
import { cn } from "@/lib/utils";

interface AdjustmentsClientContentProps {
  initialAdjustments: InventoryAdjustment[];
  products: Product[];
  currentUserRole?: string;
}

export function AdjustmentsClientContent({
  initialAdjustments,
  products,
  currentUserRole,
}: AdjustmentsClientContentProps) {
  const { toast } = useToast();
  const [adjustments, setAdjustments] = React.useState<InventoryAdjustment[]>(initialAdjustments);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = React.useState<string>("all");

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form Fields
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [productComboboxOpen, setProductComboboxOpen] = React.useState(false);
  const [adjustmentType, setAdjustmentType] = React.useState<InventoryAdjustmentType>("damage");
  const [direction, setDirection] = React.useState<"decrease" | "increase">("decrease");
  const [quantity, setQuantity] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [adjustmentDate, setAdjustmentDate] = React.useState(new Date().toISOString().split("T")[0]);

  // Selected Product details
  const selectedProduct = React.useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // When type changes, automatically set sensible default direction
  const handleTypeChange = (typeVal: InventoryAdjustmentType) => {
    setAdjustmentType(typeVal);
    const opt = adjustmentTypeOptions.find((o) => o.value === typeVal);
    if (opt) {
      setDirection(opt.defaultDirection);
    }
  };

  // Preview calculations
  const parsedQuantity = parseFloat(quantity) || 0;
  const signedQuantity = direction === "decrease" ? -parsedQuantity : parsedQuantity;
  const projectedStock = selectedProduct
    ? parseFloat((selectedProduct.quantityInStock + signedQuantity).toFixed(4))
    : 0;
  const costImpact = selectedProduct
    ? parseFloat((signedQuantity * (selectedProduct.purchasePrice || 0)).toFixed(2))
    : 0;

  // Filtered adjustments
  const filteredAdjustments = React.useMemo(() => {
    return adjustments.filter((adj) => {
      const matchesSearch =
        adj.productNameSnapshot.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adj.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (adj.notes && adj.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedTypeFilter === "all" || adj.type === selectedTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [adjustments, searchTerm, selectedTypeFilter]);

  // KPIs
  const totalWriteOffLoss = React.useMemo(() => {
    return adjustments
      .filter((a) => a.totalValueImpact < 0)
      .reduce((sum, a) => sum + Math.abs(a.totalValueImpact), 0);
  }, [adjustments]);

  const totalDeductedUnits = React.useMemo(() => {
    return adjustments
      .filter((a) => a.quantityAdjusted < 0)
      .reduce((sum, a) => sum + Math.abs(a.quantityAdjusted), 0);
  }, [adjustments]);

  const totalSurplusUnits = React.useMemo(() => {
    return adjustments
      .filter((a) => a.quantityAdjusted > 0)
      .reduce((sum, a) => sum + a.quantityAdjusted, 0);
  }, [adjustments]);

  // Reset form
  const resetForm = () => {
    setSelectedProductId("");
    setAdjustmentType("damage");
    setDirection("decrease");
    setQuantity("");
    setReason("");
    setNotes("");
    setAdjustmentDate(new Date().toISOString().split("T")[0]);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast({ title: "Product Required", description: "Please select a product to adjust.", variant: "destructive" });
      return;
    }

    if (parsedQuantity <= 0) {
      toast({ title: "Invalid Quantity", description: "Quantity must be greater than 0.", variant: "destructive" });
      return;
    }

    if (direction === "decrease" && selectedProduct && parsedQuantity > selectedProduct.quantityInStock) {
      toast({
        title: "Insufficient Stock",
        description: `Cannot deduct ${parsedQuantity} ${selectedProduct.baseUnit}. Current stock is only ${selectedProduct.quantityInStock}.`,
        variant: "destructive",
      });
      return;
    }

    if (!reason.trim()) {
      toast({ title: "Reason Required", description: "Please enter a reason for audit tracking.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordInventoryAdjustmentAction({
        productId: selectedProductId,
        type: adjustmentType,
        quantityAdjusted: signedQuantity,
        reason: reason.trim(),
        notes: notes.trim(),
        date: adjustmentDate,
      });

      if (res.success) {
        toast({ title: "Stock Adjusted", description: res.message });
        setIsDialogOpen(false);
        resetForm();

        // Optimistically update local list
        if (selectedProduct) {
          const newAdj: InventoryAdjustment = {
            id: res.adjustmentId || Math.random().toString(),
            productId: selectedProduct.id,
            productNameSnapshot: selectedProduct.name,
            categorySnapshot: selectedProduct.category,
            type: adjustmentType,
            quantityAdjusted: signedQuantity,
            unit: selectedProduct.baseUnit,
            unitCostSnapshot: selectedProduct.purchasePrice || 0,
            totalValueImpact: costImpact,
            reason: reason.trim(),
            notes: notes.trim(),
            date: adjustmentDate,
            createdAt: new Date().toISOString(),
          };
          setAdjustments((prev) => [newAdj, ...prev]);
        }
      } else {
        toast({ title: "Adjustment Failed", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revert / Delete Handler
  const handleDelete = async (adjustment: InventoryAdjustment) => {
    if (
      !confirm(
        `Are you sure you want to revert this adjustment of ${adjustment.quantityAdjusted} ${adjustment.unit} for ${adjustment.productNameSnapshot}? This will reverse the stock change.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteInventoryAdjustmentAction(adjustment.id);
      if (res.success) {
        toast({ title: "Reverted", description: res.message });
        setAdjustments((prev) => prev.filter((a) => a.id !== adjustment.id));
      } else {
        toast({ title: "Failed to Revert", description: res.message, variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Could not revert adjustment.", variant: "destructive" });
    }
  };

  const getTypeBadge = (type: InventoryAdjustmentType) => {
    switch (type) {
      case "damage":
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200">Damaged / Broken</Badge>;
      case "expiry":
        return <Badge variant="destructive" className="bg-orange-500/10 text-orange-600 border-orange-200">Expired Stock</Badge>;
      case "theft_or_loss":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-300">Theft / Missing</Badge>;
      case "audit_discrepancy":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Physical Audit</Badge>;
      case "internal_use":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">Internal Use</Badge>;
      default:
        return <Badge variant="secondary">Correction</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground">
              <Link href="/products">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Products
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" /> Stock Adjustments & Waste Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit discrepancies, damaged items, expired batches, and physical inventory reconciliations.
          </p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-sm">
          <PlusCircle className="h-4 w-4" /> Record Stock Adjustment
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Waste / Write-Offs</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">Rs. {totalWriteOffLoss.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Cost value of damaged & expired stock</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deducted Units</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalDeductedUnits}</div>
            <p className="text-xs text-muted-foreground mt-1">Units discarded or written off</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Surplus / Added Units</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">+{totalSurplusUnits}</div>
            <p className="text-xs text-muted-foreground mt-1">Found in audit reconciliations</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Audit Log Entries</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{adjustments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total adjustment entries recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name, reason, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  <SelectItem value="damage">Damaged / Broken</SelectItem>
                  <SelectItem value="expiry">Expired Stock</SelectItem>
                  <SelectItem value="theft_or_loss">Theft / Missing</SelectItem>
                  <SelectItem value="audit_discrepancy">Physical Audit</SelectItem>
                  <SelectItem value="internal_use">Internal Use</SelectItem>
                  <SelectItem value="other">Other Corrections</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustments Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-base font-semibold">Adjustment History</CardTitle>
          <CardDescription>
            Showing {filteredAdjustments.length} of {adjustments.length} logged adjustments
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAdjustments.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground">No adjustments found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm || selectedTypeFilter !== "all"
                  ? "Try changing your search terms or filter criteria."
                  : "No stock adjustments have been recorded yet. Use the 'Record Stock Adjustment' button to log damage, expiry, or audit corrections."}
              </p>
              {!searchTerm && selectedTypeFilter === "all" && (
                <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="mt-4 gap-2">
                  <PlusCircle className="h-4 w-4" /> Record First Adjustment
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                  <tr>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Product</th>
                    <th scope="col" className="px-6 py-3">Type</th>
                    <th scope="col" className="px-6 py-3 text-right">Qty Changed</th>
                    <th scope="col" className="px-6 py-3 text-right">Cost Impact</th>
                    <th scope="col" className="px-6 py-3">Reason / Notes</th>
                    <th scope="col" className="px-6 py-3">Recorded By</th>
                    {currentUserRole === "owner" && (
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredAdjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {adj.date}
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground">
                        <Link href={`/products/${adj.productId}`} className="hover:underline flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          {adj.productNameSnapshot}
                        </Link>
                        {adj.categorySnapshot && (
                          <span className="text-xs text-muted-foreground block capitalize">{adj.categorySnapshot}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {getTypeBadge(adj.type)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap font-medium">
                        <span
                          className={
                            adj.quantityAdjusted < 0
                              ? "text-destructive"
                              : "text-emerald-600"
                          }
                        >
                          {adj.quantityAdjusted > 0 ? `+${adj.quantityAdjusted}` : adj.quantityAdjusted}{" "}
                          <span className="text-xs text-muted-foreground">{adj.unit}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap font-medium">
                        <span
                          className={
                            adj.totalValueImpact < 0
                              ? "text-destructive"
                              : "text-emerald-600"
                          }
                        >
                          {adj.totalValueImpact < 0 ? `-Rs. ${Math.abs(adj.totalValueImpact).toFixed(2)}` : `+Rs. ${adj.totalValueImpact.toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 max-w-xs">
                        <p className="font-medium text-foreground truncate">{adj.reason}</p>
                        {adj.notes && <p className="text-xs text-muted-foreground truncate">{adj.notes}</p>}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs text-muted-foreground">
                        {adj.recordedByName || adj.recordedByEmail || "System"}
                      </td>
                      {currentUserRole === "owner" && (
                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(adj)}
                            title="Revert adjustment & restore stock"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Stock Adjustment Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" /> Record Stock Adjustment
            </DialogTitle>
            <DialogDescription>
              Adjust product inventory for damages, expiration, physical audit discrepancies, or losses.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Product Selector */}
            <div className="space-y-1.5">
              <Label>Product *</Label>
              <Popover open={productComboboxOpen} onOpenChange={setProductComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal text-left"
                  >
                    {selectedProduct ? (
                      <span className="flex items-center justify-between w-full">
                        <span className="truncate">{selectedProduct.name}</span>
                        <Badge variant="secondary" className="ml-2 shrink-0">
                          Stock: {selectedProduct.quantityInStock} {selectedProduct.baseUnit}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select a product...</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search product by name, SKU, or barcode..." />
                    <CommandList>
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup heading="Available Products">
                        {products.map((prod) => (
                          <CommandItem
                            key={prod.id}
                            value={`${prod.name} ${prod.sku || ""} ${prod.barcode || ""}`}
                            onSelect={() => {
                              setSelectedProductId(prod.id);
                              setProductComboboxOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="truncate">{prod.name}</span>
                              <Badge
                                variant={prod.quantityInStock <= 0 ? "destructive" : "secondary"}
                                className="ml-2 shrink-0 text-xs"
                              >
                                {prod.quantityInStock} {prod.baseUnit}
                              </Badge>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Adjustment Type */}
            <div className="space-y-1.5">
              <Label>Adjustment Type *</Label>
              <Select value={adjustmentType} onValueChange={(val) => handleTypeChange(val as InventoryAdjustmentType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {adjustmentTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col text-left py-0.5">
                        <span className="font-medium text-foreground">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Direction & Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stock Action *</Label>
                <Select value={direction} onValueChange={(val: "decrease" | "increase") => setDirection(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decrease">
                      <span className="text-destructive font-medium">− Deduct from Stock</span>
                    </SelectItem>
                    <SelectItem value="increase">
                      <span className="text-emerald-600 font-medium">+ Add to Stock</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Quantity ({selectedProduct ? selectedProduct.baseUnit : "units"}) *
                </Label>
                <Input
                  type="number"
                  step="any"
                  min="0.001"
                  placeholder="e.g. 5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            </div>

            {/* Live Stock & Value Impact Callout */}
            {selectedProduct && parsedQuantity > 0 && (
              <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Inventory:</span>
                  <span className="font-medium text-foreground">
                    {selectedProduct.quantityInStock} {selectedProduct.baseUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>New Projected Stock:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      projectedStock < 0 ? "text-destructive" : "text-foreground"
                    )}
                  >
                    {projectedStock} {selectedProduct.baseUnit}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground pt-1 border-t">
                  <span>Estimated Cost Value:</span>
                  <span className={costImpact < 0 ? "font-medium text-destructive" : "font-medium text-emerald-600"}>
                    {costImpact < 0 ? `-Rs. ${Math.abs(costImpact).toFixed(2)}` : `+Rs. ${costImpact.toFixed(2)}`}
                  </span>
                </div>
                {direction === "decrease" && projectedStock < 0 && (
                  <p className="text-destructive font-semibold pt-1">
                    Warning: You are attempting to deduct more than available in stock!
                  </p>
                )}
              </div>
            )}

            {/* Date & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Adjustment Date</Label>
                <Input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Reason / Cause *</Label>
                <Input
                  placeholder="e.g. Broken in transit, Expired batch 2026-A"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <Label>Additional Notes (Optional)</Label>
              <Input
                placeholder="Disposal notes, supplier claim ref, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedProductId || parsedQuantity <= 0}>
                {isSubmitting ? "Recording..." : "Save Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
