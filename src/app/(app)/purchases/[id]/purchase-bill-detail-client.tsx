'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  Truck,
  Building2,
  Calendar,
  User,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PurchaseBill } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface PurchaseBillDetailClientProps {
  bill: PurchaseBill;
  userRole?: string;
  shopDetails?: {
    shopName?: string;
    shopAddress?: string;
    shopContact?: string;
  };
}

export function PurchaseBillDetailClient({
  bill,
  userRole,
  shopDetails,
}: PurchaseBillDetailClientProps) {
  const handlePrint = () => {
    window.print();
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMMM yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar (hidden when printing) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="p-0 h-auto text-muted-foreground hover:text-foreground mb-1">
            <Link href="/purchases">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Purchases Register
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" /> Purchase Inward Slip
          </h1>
          <p className="text-sm text-muted-foreground">
            Reference: {bill.invoiceNumber || `BILL-${bill.id.slice(0, 8).toUpperCase()}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print Inward Slip
          </Button>
        </div>
      </div>

      {/* Printable Receipt / Bill Card */}
      <Card className="border shadow-sm print:border-none print:shadow-none">
        <CardHeader className="border-b pb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl font-bold font-headline">
                {shopDetails?.shopName || 'WholesaleWise Store'}
              </h2>
              {shopDetails?.shopAddress && (
                <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">
                  {shopDetails.shopAddress}
                </p>
              )}
              {shopDetails?.shopContact && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Phone: {shopDetails.shopContact}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block text-xs uppercase tracking-wider font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded mb-2">
                Stock Inward Document
              </span>
              <div className="text-sm">
                <span className="text-muted-foreground">Bill / Invoice #: </span>
                <span className="font-mono font-semibold">
                  {bill.invoiceNumber || `BILL-${bill.id.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Purchase Date: </span>
                <span className="font-medium">{formatDisplayDate(bill.purchaseDate)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Status: </span>
                <span className="capitalize font-semibold">
                  {bill.paymentStatus.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Supplier Info & Payment Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40">
            <div>
              <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Supplier Details
              </h3>
              <p className="text-base font-bold text-foreground">{bill.supplierName}</p>
              {bill.supplierPhone && (
                <p className="text-sm text-muted-foreground mt-0.5">Contact: {bill.supplierPhone}</p>
              )}
              {bill.notes && (
                <p className="text-xs text-muted-foreground mt-2 italic">Remarks: {bill.notes}</p>
              )}
            </div>

            <div>
              <h3 className="text-xs uppercase font-semibold text-muted-foreground tracking-wider mb-2 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Payment & Recording
              </h3>
              <div className="text-sm flex justify-between py-0.5">
                <span className="text-muted-foreground">Payment Mode:</span>
                <span className="font-medium capitalize">{bill.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="text-sm flex justify-between py-0.5">
                <span className="text-muted-foreground">Recorded By:</span>
                <span className="font-medium">{bill.recordedByName || bill.recordedByEmail || 'Staff'}</span>
              </div>
              <div className="text-sm flex justify-between py-0.5">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="font-medium">{formatDisplayDate(bill.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-base font-semibold mb-3">Inward Items Summary</h3>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Product Description</TableHead>
                    <TableHead className="text-right">Quantity Inwarded</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price (Rs.)</TableHead>
                    <TableHead className="text-right">Line Total (Rs.)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.productNameSnapshot}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.quantityPurchased}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">
                          {item.purchaseUnit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        Rs. {item.purchasePricePerUnit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        Rs. {item.itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="flex flex-col sm:flex-row justify-end items-end gap-6 pt-4">
            <div className="w-full sm:w-72 space-y-2 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Grand Inward Total:</span>
                <span className="font-bold text-base">
                  Rs. {bill.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount Paid:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Rs. {bill.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="font-semibold text-foreground">Supplier Due / Balance:</span>
                <span className={`font-bold ${bill.amountDue > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  Rs. {bill.amountDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
