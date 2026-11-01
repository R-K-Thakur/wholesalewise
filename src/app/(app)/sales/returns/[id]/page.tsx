import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer, FileText, RotateCcw, CheckCircle2, User, Phone, Calendar, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSaleReturnByIdAction } from '../actions';
import { PrintCreditNoteButton } from './print-button';
import { APP_NAME } from '@/lib/constants';

interface CreditNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CreditNoteDetailPage({ params }: CreditNoteDetailPageProps) {
  const resolvedParams = await params;
  const returnData = await getSaleReturnByIdAction(resolvedParams.id);

  if (!returnData) {
    notFound();
  }

  const getRefundMethodText = (method: string) => {
    switch (method) {
      case 'deduct_customer_due':
        return 'Deducted from Customer Outstanding Due';
      case 'cash':
        return 'Refunded via Cash';
      case 'store_credit':
        return 'Store Credit for Future Purchases';
      default:
        return method;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Action Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground mb-1">
            <Link href="/sales/returns">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Returns
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" /> Credit Note: {returnData.returnNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Official credit note voucher and customer return record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/sales/${returnData.saleId}`}>
              <FileText className="h-4 w-4 mr-2" /> View Original Invoice
            </Link>
          </Button>
          <PrintCreditNoteButton />
        </div>
      </div>

      {/* Printable Credit Note Document */}
      <Card className="border border-border/80 shadow-md bg-card print:border-none print:shadow-none p-6 sm:p-10">
        <CardContent className="p-0 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start pb-6 border-b border-border/60 gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-primary font-bold">CREDIT NOTE / RETURN VOUCHER</span>
              <h2 className="text-2xl font-black tracking-tight text-foreground mt-1">{APP_NAME}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Wholesale Inventory & Billing</p>
            </div>
            <div className="text-right sm:text-right space-y-1">
              <div className="text-xl font-mono font-bold text-primary">{returnData.returnNumber}</div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Date:</span> {returnData.returnDate}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Invoice Ref:</span> #{returnData.saleId}
              </p>
            </div>
          </div>

          {/* Customer & Issue Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/20 border border-border/40 text-sm">
            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Customer Details
              </h4>
              <p className="font-bold text-foreground text-base">
                {returnData.customerName || 'Walk-in Customer'}
              </p>
              {returnData.customerPhone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" /> {returnData.customerPhone}
                </p>
              )}
            </div>
            <div className="sm:text-right space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Settlement & Reason
              </h4>
              <p className="text-sm font-medium text-foreground">
                {getRefundMethodText(returnData.refundMethod)}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Reason:</span> {returnData.returnReason}
              </p>
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-y">
                <tr>
                  <th scope="col" className="py-3 px-3 w-10">#</th>
                  <th scope="col" className="py-3 px-4">Item Description</th>
                  <th scope="col" className="py-3 px-3 text-center">Condition</th>
                  <th scope="col" className="py-3 px-3 text-right">Qty Returned</th>
                  <th scope="col" className="py-3 px-4 text-right">Unit Rate (Rs.)</th>
                  <th scope="col" className="py-3 px-4 text-right">Credit Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {returnData.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{index + 1}</td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {item.productNameSnapshot}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant={item.condition === 'resellable' ? 'secondary' : 'destructive'}
                        className="text-xs font-normal capitalize"
                      >
                        {item.condition === 'resellable' ? 'Restocked' : 'Damaged / Scrap'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">
                      {item.quantityReturned} <span className="text-xs text-muted-foreground">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {item.pricePerUnit.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-foreground">
                      {item.totalRefund.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Notes Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-border/60">
            <div className="max-w-md space-y-2 text-xs text-muted-foreground">
              {returnData.notes && (
                <p>
                  <span className="font-semibold text-foreground">Notes:</span> {returnData.notes}
                </p>
              )}
              <p className="italic">
                Goods accepted for return subject to inspection. Resellable items have been replenished into warehouse inventory.
              </p>
            </div>

            <div className="w-full sm:w-64 space-y-2 text-right">
              <div className="flex justify-between text-base font-bold pt-2 border-t text-foreground">
                <span>Total Credit Value:</span>
                <span className="text-xl text-primary font-black">
                  Rs. {returnData.totalReturnAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-16 grid grid-cols-2 gap-8 text-center text-xs text-muted-foreground border-t border-border/40">
            <div>
              <div className="border-t border-muted-foreground/30 w-48 mx-auto mb-1"></div>
              <p className="font-semibold text-foreground">Customer Signature</p>
            </div>
            <div>
              <div className="border-t border-muted-foreground/30 w-48 mx-auto mb-1"></div>
              <p className="font-semibold text-foreground">Authorized Signatory</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
