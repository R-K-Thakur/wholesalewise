"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IndianRupee,
  Receipt,
  PlusCircle,
  FileText,
  Printer,
  Edit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Customer, CustomerTransaction, CustomerFormData } from "@/lib/types";
import { getCustomerByIdAction, recordCustomerPaymentAction, updateCustomerAction } from "../actions";
import { cn } from "@/lib/utils";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customerId = params.id as string;

  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [transactions, setTransactions] = React.useState<CustomerTransaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filterType, setFilterType] = React.useState<"all" | "sale" | "payment">("all");

  // Payment dialog state
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "online">("cash");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState<CustomerFormData>({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const loadCustomerData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCustomerByIdAction(customerId);
      if (data.customer) {
        setCustomer(data.customer);
        setTransactions(data.transactions);
        setEditFormData({
          name: data.customer.name,
          phone: data.customer.phone || "",
          email: data.customer.email || "",
          address: data.customer.address || "",
          notes: data.customer.notes || "",
        });
      } else {
        toast({ title: "Customer Not Found", description: "The requested customer profile does not exist.", variant: "destructive" });
      }
    } catch (e) {
      console.error("Error loading customer data:", e);
      toast({ title: "Error", description: "Failed to load customer profile.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [customerId, toast]);

  React.useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive payment amount.", variant: "destructive" });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const result = await recordCustomerPaymentAction({
        customerId: customer.id,
        amount: amountNum,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
      });

      if (result.success) {
        toast({ title: "Payment Recorded", description: result.message });
        setIsPaymentOpen(false);
        setPaymentAmount("");
        setPaymentNotes("");
        await loadCustomerData();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleEditCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    if (!editFormData.name?.trim()) {
      toast({ title: "Name Required", description: "Customer name cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const result = await updateCustomerAction(customer.id, editFormData);
      if (result.success) {
        toast({ title: "Profile Updated", description: result.message });
        setIsEditOpen(false);
        await loadCustomerData();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to update customer.", variant: "destructive" });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const filteredTransactions = React.useMemo(() => {
    if (filterType === "all") return transactions;
    return transactions.filter((t) => t.type === filterType);
  }, [transactions, filterType]);

  const handlePrintStatement = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">Loading customer profile and transaction ledger...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-bold">Customer Not Found</h2>
        <p className="text-sm text-muted-foreground">The customer profile you are looking for does not exist or was deleted.</p>
        <Button asChild variant="outline">
          <Link href="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  const hasDue = customer.totalDue > 0.001;

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/customers">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Customers</span>
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">{customer.name}</h1>
              {hasDue ? (
                <Badge variant="destructive" className="font-semibold">
                  Due: Rs. {customer.totalDue.toFixed(2)}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-green-600 bg-green-50 border-green-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" /> All Settled
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customer Account & Individual Ledger Profile
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasDue && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={() => {
                setPaymentAmount(customer.totalDue.toFixed(2));
                setIsPaymentOpen(true);
              }}
            >
              <Receipt className="mr-2 h-4 w-4" /> Settle Due / Collect Payment
            </Button>
          )}

          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>

          <Button variant="outline" onClick={handlePrintStatement}>
            <Printer className="mr-2 h-4 w-4" /> Print Statement
          </Button>

          <Button asChild variant="default">
            <Link href="/sales/new">
              <PlusCircle className="mr-2 h-4 w-4" /> New Sale
            </Link>
          </Button>
        </div>
      </div>

      {/* Customer Info Card & Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Customer Details */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{customer.phone || "Not provided"}</p>
              </div>
            </div>

            {customer.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              </div>
            )}

            {customer.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="font-medium">{customer.address}</p>
                </div>
              </div>
            )}

            {customer.notes && (
              <div className="p-2.5 rounded bg-muted/50 text-xs">
                <span className="font-medium text-foreground">Notes: </span>
                <span className="text-muted-foreground">{customer.notes}</span>
              </div>
            )}

            <div className="flex items-start gap-2 pt-2 border-t text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 mt-0.5" />
              <span>Customer since {new Date(customer.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Financial Stat Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className={cn(
            "border-l-4 shadow-sm",
            hasDue ? "border-l-destructive bg-destructive/5" : "border-l-green-600 bg-green-500/5"
          )}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Current Due Balance
              </CardDescription>
              <CardTitle className={cn("text-2xl font-bold", hasDue ? "text-destructive" : "text-green-600")}>
                Rs. {customer.totalDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {hasDue ? "Pending amount owed by customer" : "Account is completely cleared"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Total Billed / Purchases
              </CardDescription>
              <CardTitle className="text-2xl font-bold">
                Rs. {customer.totalPurchases.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Cumulative value of all sales</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Total Amount Paid
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600">
                Rs. {customer.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Received at billing and settlements</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction History & Ledger */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 gap-2">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Individual Transaction Ledger
            </CardTitle>
            <CardDescription>
              Complete history of all sales, payments received, and balance adjustments for {customer.name}.
            </CardDescription>
          </div>

          <div className="flex rounded-md border bg-muted p-1 text-xs print:hidden">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({transactions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("sale")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "sale" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sales Only
            </button>
            <button
              type="button"
              onClick={() => setFilterType("payment")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "payment" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Payments Only
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Reference / Notes</th>
                  <th className="px-4 py-3 text-right">Debit (Due Added)</th>
                  <th className="px-4 py-3 text-right">Credit (Paid)</th>
                  <th className="px-4 py-3 text-right font-semibold">Balance Due</th>
                  <th className="px-4 py-3 text-center">Payment Mode</th>
                  <th className="px-4 py-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {filteredTransactions.map((tx) => {
                  const isSale = tx.type === "sale";
                  const isPayment = tx.type === "payment";
                  const isAdjustment = tx.type === "adjustment";

                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isSale && (
                          <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/10">
                            <ArrowUpRight className="h-3 w-3 mr-1 inline" /> Sale
                          </Badge>
                        )}
                        {isPayment && (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                            <ArrowDownLeft className="h-3 w-3 mr-1 inline" /> Payment
                          </Badge>
                        )}
                        {isAdjustment && (
                          <Badge variant="secondary">Adjustment</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <div className="max-w-xs truncate">
                          {tx.saleId && (
                            <span className="font-mono text-xs text-primary font-medium mr-2">
                              #{tx.saleId.substring(0, 8)}
                            </span>
                          )}
                          <span>{tx.notes || (isSale ? "Wholesale Sale Bill" : "Payment Received")}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                        {isSale ? (
                          <span className={tx.dueAdded > 0 ? "text-destructive" : "text-muted-foreground"}>
                            Rs. {tx.amount.toFixed(2)}
                            {tx.dueAdded > 0 && tx.amountPaid && tx.amountPaid > 0 && (
                              <span className="block text-[11px] text-muted-foreground">
                                (Due: Rs. {tx.dueAdded.toFixed(2)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-emerald-600">
                        {isPayment ? (
                          <span>Rs. {tx.amount.toFixed(2)}</span>
                        ) : isSale && tx.amountPaid && tx.amountPaid > 0 ? (
                          <span>Rs. {tx.amountPaid.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold">
                        <span className={tx.balanceAfter > 0.001 ? "text-destructive" : "text-green-600"}>
                          Rs. {tx.balanceAfter.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center text-xs capitalize text-muted-foreground">
                        {tx.paymentMethod ? tx.paymentMethod.replace("_", " ") : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center print:hidden">
                        {tx.saleId && (
                          <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
                            <Link href={`/sales/${tx.saleId}`}>View Bill</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground text-sm">
                      No transactions recorded yet for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Settle Due / Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment / Settle Due</DialogTitle>
            <DialogDescription>
              Collect payment towards <span className="font-semibold text-foreground">{customer.name}&apos;s</span> outstanding balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
            <div className="p-3 rounded-md bg-muted/60 text-sm space-y-1">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Current Due Balance:</span>
                <span className="font-bold text-destructive">Rs. {customer.totalDue.toFixed(2)}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payAmountDirect">Amount Paid (Rs.) <span className="text-destructive">*</span></Label>
              <Input
                id="payAmountDirect"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g., 500.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payMethodDirect">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                <SelectTrigger id="payMethodDirect">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="online">Online / UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payNotesDirect">Notes / Receipt Reference</Label>
              <Input
                id="payNotesDirect"
                placeholder="e.g., Hand cash / UPI Transaction ID"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isSubmittingPayment}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {isSubmittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Profile Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer Profile</DialogTitle>
            <DialogDescription>
              Update contact information and details for {customer.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCustomerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Customer Name <span className="text-destructive">*</span></Label>
              <Input
                id="editName"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPhone">Phone Number</Label>
              <Input
                id="editPhone"
                value={editFormData.phone || ""}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editFormData.email || ""}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editAddress">Address</Label>
              <Input
                id="editAddress"
                value={editFormData.address || ""}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editNotes">Notes</Label>
              <Input
                id="editNotes"
                value={editFormData.notes || ""}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmittingEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
