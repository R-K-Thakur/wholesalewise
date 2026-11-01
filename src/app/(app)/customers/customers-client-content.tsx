"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  PlusCircle,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Phone,
  User,
  Loader2,
  Receipt,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Customer, CustomerFormData } from "@/lib/types";
import { createCustomerAction, recordCustomerPaymentAction } from "./actions";
import { cn } from "@/lib/utils";

interface CustomersClientContentProps {
  initialCustomers: Customer[];
}

export function CustomersClientContent({ initialCustomers }: CustomersClientContentProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [customers, setCustomers] = React.useState<Customer[]>(initialCustomers);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<"all" | "with_due" | "settled">("all");

  // Add Customer Dialog state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = React.useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = React.useState(false);
  const [newCustomerForm, setNewCustomerForm] = React.useState<CustomerFormData>({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  // Quick Collect Payment Dialog state
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = React.useState(false);
  const [paymentCustomer, setPaymentCustomer] = React.useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "online">("cash");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = React.useState(false);

  React.useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  // Calculations for summary metrics
  const totalOutstandingDue = React.useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.totalDue > 0 ? c.totalDue : 0), 0);
  }, [customers]);

  const customersWithDueCount = React.useMemo(() => {
    return customers.filter((c) => c.totalDue > 0.001).length;
  }, [customers]);

  // Filtering
  const filteredCustomers = React.useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (customer.phone && customer.phone.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      if (!matchesSearch) return false;

      if (filterType === "with_due") return customer.totalDue > 0.001;
      if (filterType === "settled") return customer.totalDue <= 0.001;
      return true;
    });
  }, [customers, searchTerm, filterType]);

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.name.trim()) {
      toast({ title: "Name Required", description: "Please enter customer name.", variant: "destructive" });
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const result = await createCustomerAction(newCustomerForm);
      if (result.success) {
        toast({ title: "Success", description: result.message });
        setIsAddCustomerOpen(false);
        setNewCustomerForm({ name: "", phone: "", email: "", address: "", notes: "" });
        router.refresh();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create customer profile.", variant: "destructive" });
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleOpenCollectPayment = (customer: Customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount(customer.totalDue > 0 ? customer.totalDue.toFixed(2) : "");
    setPaymentMethod("cash");
    setPaymentNotes("");
    setIsCollectPaymentOpen(true);
  };

  const handleCollectPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;

    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid payment amount.", variant: "destructive" });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const result = await recordCustomerPaymentAction({
        customerId: paymentCustomer.id,
        amount: amountNum,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
      });

      if (result.success) {
        toast({ title: "Payment Recorded", description: result.message });
        setIsCollectPaymentOpen(false);
        router.refresh();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to record payment.", variant: "destructive" });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-destructive shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding Due</CardTitle>
            <IndianRupee className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              Rs. {totalOutstandingDue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending receivable from all customers</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Customers with Dues</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customersWithDueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              out of {customers.length} total customer profiles
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded customer accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Control bar: search, filters, add customer */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("with_due")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "with_due" ? "bg-background text-destructive shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              With Due ({customersWithDueCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("settled")}
              className={cn(
                "px-2.5 py-1 rounded font-medium transition-colors",
                filterType === "settled" ? "bg-background text-green-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Settled ({customers.length - customersWithDueCount})
            </button>
          </div>

          <Button onClick={() => setIsAddCustomerOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="border rounded-lg overflow-x-auto bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone / Contact</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Purchases</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Paid</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding Due</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filteredCustomers.map((cust) => {
              const hasDue = cust.totalDue > 0.001;
              return (
                <tr key={cust.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Link
                      href={`/customers/${cust.id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      {cust.name}
                    </Link>
                    {cust.address && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{cust.address}</p>}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-muted-foreground">
                    {cust.phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {cust.phone}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-right text-muted-foreground">
                    Rs. {cust.totalPurchases.toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-right text-muted-foreground">
                    Rs. {cust.totalPaid.toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-right font-medium">
                    {hasDue ? (
                      <Badge variant="destructive" className="font-semibold">
                        Rs. {cust.totalDue.toFixed(2)}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Settled
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-center space-x-1.5">
                    {hasDue && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleOpenCollectPayment(cust)}
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1" /> Settle Due
                      </Button>
                    )}
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs">
                      <Link href={`/customers/${cust.id}`}>
                        View Profile <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  {searchTerm
                    ? "No customers match your search query."
                    : filterType === "with_due"
                    ? "Great! No customers currently have an outstanding balance due."
                    : "No customer profiles recorded yet. New customer profiles will automatically be created when recording sales with dues, or you can add one manually."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Customer Modal */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a customer profile to track their purchase history, dues, and payment records.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custName">Customer Name <span className="text-destructive">*</span></Label>
              <Input
                id="custName"
                placeholder="e.g., Ramesh Traders"
                value={newCustomerForm.name}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custPhone">Phone Number</Label>
              <Input
                id="custPhone"
                placeholder="e.g., 9876543210"
                value={newCustomerForm.phone || ""}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custEmail">Email Address</Label>
              <Input
                id="custEmail"
                type="email"
                placeholder="e.g., ramesh@example.com"
                value={newCustomerForm.email || ""}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custAddress">Shop / Delivery Address</Label>
              <Input
                id="custAddress"
                placeholder="e.g., Shop #12, Main Wholesale Market"
                value={newCustomerForm.address || ""}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custNotes">Notes</Label>
              <Input
                id="custNotes"
                placeholder="e.g., Regular client, prefers weekly payment"
                value={newCustomerForm.notes || ""}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddCustomerOpen(false)} disabled={isSubmittingAdd}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingAdd}>
                {isSubmittingAdd && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Profile
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collect / Settle Due Payment Modal */}
      <Dialog open={isCollectPaymentOpen} onOpenChange={setIsCollectPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settle Due / Collect Payment</DialogTitle>
            <DialogDescription>
              Record a payment received from <span className="font-semibold text-foreground">{paymentCustomer?.name}</span> to decrease their outstanding due.
            </DialogDescription>
          </DialogHeader>
          {paymentCustomer && (
            <form onSubmit={handleCollectPaymentSubmit} className="space-y-4">
              <div className="p-3 rounded-md bg-muted/60 text-sm space-y-1">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Current Due Balance:</span>
                  <span className="font-bold text-destructive">Rs. {paymentCustomer.totalDue.toFixed(2)}</span>
                </p>
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Total Previous Purchases:</span>
                  <span>Rs. {paymentCustomer.totalPurchases.toFixed(2)}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payAmount">Amount Paid (Rs.) <span className="text-destructive">*</span></Label>
                <Input
                  id="payAmount"
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
                <Label htmlFor="payMethod">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                  <SelectTrigger id="payMethod">
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
                <Label htmlFor="payNotes">Notes / Receipt Reference (Optional)</Label>
                <Input
                  id="payNotes"
                  placeholder="e.g., UPI Transaction ID or Hand cash"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCollectPaymentOpen(false)} disabled={isSubmittingPayment}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingPayment} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSubmittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
