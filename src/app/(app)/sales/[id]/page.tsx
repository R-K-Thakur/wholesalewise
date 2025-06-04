
"use client"; 

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Eye, Loader2 } from 'lucide-react';
import { getSaleByIdAction } from '../actions'; 
import type { Sale } from '@/lib/types'; 
import { APP_NAME } from '@/lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = params.id as string;
  const [sale, setSale] = useState<Sale | undefined | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (saleId) {
      setIsLoading(true);
      getSaleByIdAction(saleId)
        .then(fetchedSale => {
          setSale(fetchedSale);
        })
        .catch(err => {
          console.error("Failed to fetch sale details:", err);
          setSale(undefined); 
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [saleId]);

  const generateInvoicePDF = (outputType: 'save' | 'datauristring' = 'save'): string | void => {
    if (!sale) return;
    setIsProcessingPdf(true);

    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      let startY = 20;

      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(APP_NAME, pageWidth / 2, startY, { align: 'center' });
      startY += 10;

      doc.setFontSize(14);
      doc.text("INVOICE", pageWidth / 2, startY, { align: 'center' });
      startY += 10;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Invoice ID: ${sale.id}`, 15, startY);
      doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, pageWidth - 15, startY, { align: 'right' });
      startY += 7;

      if (sale.customerName) {
        doc.text(`Customer: ${sale.customerName}`, 15, startY);
        startY += 7;
      }
      
      doc.text(`Sale Type: ${sale.saleType.charAt(0).toUpperCase() + sale.saleType.slice(1)}`, 15, startY);
      startY += 10;

      const tableColumn = ["Product Name", "Qty", "Unit", `Price/Unit (${String.fromCharCode(8377)})`, `Total (${String.fromCharCode(8377)})`];
      const tableRows: (string | number)[][] = [];

      sale.items.forEach(item => {
        const itemData = [
          item.productNameSnapshot,
          item.quantitySold,
          item.soldUnit,
          item.pricePerUnitSold.toFixed(2),
          item.total.toFixed(2)
        ];
        tableRows.push(itemData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        margin: { top: 10 },
      });
      
      startY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Grand Total: ${String.fromCharCode(8377)} ${sale.totalAmount.toFixed(2)}`, pageWidth - 15, startY, { align: 'right' });
      startY += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (sale.paymentMethod) {
        doc.text(`Payment Method: ${sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}`, pageWidth - 15, startY, { align: 'right' });
        startY += 7;
      }

      if (sale.notes) {
        if (startY > pageHeight - 30) { 
            doc.addPage();
            startY = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Notes:", 15, startY);
        startY += 5;
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(sale.notes, pageWidth - 30);
        doc.text(splitNotes, 15, startY);
        startY += (splitNotes.length * 5) + 5;
      }

       if (startY > pageHeight - 20) {
            doc.addPage();
            startY = 20;
        }
      doc.setFontSize(10);
      doc.text("Thank you for your business!", pageWidth / 2, startY, { align: 'center' });

      if (outputType === 'datauristring') {
        return doc.output('datauristring');
      } else {
        doc.save(`invoice-${sale.id}.pdf`);
      }
    } catch (error) {
        console.error("Error generating PDF:", error);
    } finally {
        setIsProcessingPdf(false);
    }
  };

  const handlePreviewBill = () => {
    const dataUri = generateInvoicePDF('datauristring');
    if (dataUri) {
      setPreviewPdfUrl(dataUri);
      setIsPreviewModalOpen(true);
    }
  };

  const handleDownloadPdf = () => {
    generateInvoicePDF('save');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading sale details...</p>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-xl text-muted-foreground">Sale not found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/sales">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sales
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/sales">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Sales</span>
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline">
            Sale Details
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handlePreviewBill} disabled={isProcessingPdf} variant="outline" className="w-full sm:w-auto">
            {isProcessingPdf && previewPdfUrl === null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview Bill
          </Button>
          <Button onClick={handleDownloadPdf} disabled={isProcessingPdf} className="w-full sm:w-auto">
            {isProcessingPdf && previewPdfUrl !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Information</CardTitle>
          <CardDescription>
            Details for sale transaction ID: {sale.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><strong>Customer:</strong> {sale.customerName || 'N/A'}</div>
            <div><strong>Sale Date:</strong> {new Date(sale.saleDate).toLocaleDateString()}</div>
            <div><strong>Sale Type:</strong> <span className="capitalize">{sale.saleType}</span></div>
            <div><strong>Payment Method:</strong> <span className="capitalize">{sale.paymentMethod || 'N/A'}</span></div>
            {sale.notes && <div className="md:col-span-2"><strong>Notes:</strong> {sale.notes}</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items Sold</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Price/Unit (Rs.)</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total (Rs.)</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sale.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-foreground">{item.productNameSnapshot}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{item.quantitySold}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{item.soldUnit}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">Rs. {item.pricePerUnitSold.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">Rs. {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right">
            <p className="text-lg font-semibold">Grand Total: Rs. {sale.totalAmount.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Invoice Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-0 m-0 overflow-hidden">
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                width="100%"
                height="100%"
                className="border-0"
                title="Invoice Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading preview...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    