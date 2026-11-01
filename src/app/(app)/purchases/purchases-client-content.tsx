'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Truck,
  PlusCircle,
  Search,
  ArrowUpDown,
  Building2,
  Calendar,
  Eye,
  Trash2,
  IndianRupee,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PurchaseBill } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { deletePurchaseBillAction } from './actions';
import { format, parseISO } from 'date-fns';

interface PurchasesClientContentProps {
  initialBills: PurchaseBill[];
  userRole?: string;
}

export function PurchasesClientContent({ initialBills, userRole }: PurchasesClientContentProps) {
  const { toast } = useToast();
  const [bills, setBills] = React.useState<PurchaseBill[]>(initialBills);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [sortOrder, setSortOrder] = React.useState<'desc' | 'asc'>('desc');

  // Deletion state
  const [billToDelete, setBillToDelete] = React.useState<PurchaseBill | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Sync state if initialBills change
  React.useEffect(() => {
    setBills(initialBills);
  }, [initialBills]);

  // Statistics
  const totalSpend = React.useMemo(() => {
    return bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }, [bills]);

  const totalSupplierDue = React.useMemo(() => {
    return bills.reduce((sum, b) => sum + (b.amountDue > 0 ? b.amountDue : 0), 0);
  }, [bills]);

  const paidBillsCount = React.useMemo(() => {
    return bills.filter((b) => b.paymentStatus === 'paid').length;
  }, [bills]);

  // Filtered & Sorted Bills
  const filteredBills = React.useMemo(() => {
    let result = [...bills];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.supplierName?.toLowerCase().includes(q) ||
          b.invoiceNumber?.toLowerCase().includes(q) ||
          b.notes?.toLowerCase().includes(q) ||
          b.items?.some((i) => i.productNameSnapshot?.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((b) => b.paymentStatus === statusFilter);
    }

    result.sort((a, b) => {
      const timeA = new Date(a.purchaseDate).getTime();
      const timeB = new Date(b.purchaseDate).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [bills, searchTerm, statusFilter, sortOrder]);

  const handleDeleteBill = async () => {
    if (!billToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deletePurchaseBillAction(billToDelete.id);
      if (res.success) {
        toast({
          title: 'Purchase Bill Deleted',
          description: res.message,
        });
        setBills((prev) => prev.filter((b) => b.id !== billToDelete.id));
      } else {
        toast({
          title: 'Delete Failed',
          description: res.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setBillToDelete(null);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: PurchaseBill['paymentStatus'], due: number) => {
    switch (status) {
      case 'paid':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        );
      case 'partially_paid':
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" /> Part Paid (Due Rs. {due.toFixed(2)})
          </Badge>
        );
      case 'unpaid':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <AlertCircle className="h-3 w-3 mr-1" /> Unpaid (Credit)
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" /> Purchases & Inward Stock
          </h1>
          <p className="text-sm text-muted-foreground">
            Track inward supplier bills, stock additions, and manage accounts payable.
          </p>
        </div>
        <Button asChild size="default" className="shadow-sm">
          <Link href="/purchases/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Record Inward Purchase
          </Link>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inward Spend</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {totalSpend.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative purchase expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inward Bills</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Supplier invoices logged</p>
          </CardContent>
        </Card>

        <Card className={cn(totalSupplierDue > 0.001 && 'border-l-4 border-l-amber-500')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Supplier Payables / Due</CardTitle>
            <Building2 className={cn('h-4 w-4', totalSupplierDue > 0.001 ? 'text-amber-500' : 'text-muted-foreground')} />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', totalSupplierDue > 0.001 ? 'text-amber-600 dark:text-amber-400' : '')}>
              Rs. {totalSupplierDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Amount owed to vendors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Settled Bills</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {paidBillsCount} / {bills.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Fully paid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Search, Filter & Purchases Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search supplier, bill #, product..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid / Credit</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                title="Toggle Date Sort Order"
                onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill / Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Mode</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {bills.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <Truck className="h-8 w-8 text-muted-foreground/60" />
                          <p>No purchase bills recorded yet.</p>
                          <Button asChild size="sm" variant="outline">
                            <Link href="/purchases/new">Record First Inward Purchase</Link>
                          </Button>
                        </div>
                      ) : (
                        'No purchase bills match your search criteria.'
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDisplayDate(bill.purchaseDate)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                          {bill.invoiceNumber || `BILL-${bill.id.slice(0, 6).toUpperCase()}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{bill.supplierName}</div>
                        {bill.supplierPhone && (
                          <div className="text-xs text-muted-foreground">{bill.supplierPhone}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{bill.items?.length || 0} line items</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {bill.items?.map((i) => i.productNameSnapshot).join(', ')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        Rs. {bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                        Rs. {bill.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(bill.paymentStatus, bill.amountDue)}</TableCell>
                      <TableCell>
                        <span className="capitalize text-xs bg-secondary px-2 py-1 rounded">
                          {bill.paymentMethod.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <Link href={`/purchases/${bill.id}`} title="View Purchase Inward Slip">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {userRole === 'owner' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              title="Delete Purchase Bill"
                              onClick={() => setBillToDelete(bill)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!billToDelete} onOpenChange={(open) => !open && setBillToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Bill?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase bill{' '}
              <strong>{billToDelete?.invoiceNumber || billToDelete?.id}</strong> from{' '}
              <strong>{billToDelete?.supplierName}</strong>?
              <br />
              <span className="text-destructive font-semibold mt-2 block">
                Warning: The stock added by this purchase will be rolled back from inventory!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBill}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm & Rollback Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
