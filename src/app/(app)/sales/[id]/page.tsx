
"use client"; // This page needs to be a client component for PDF generation

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { getSaleByIdAction } from '../actions'; // Import the action
import type { Sale } from '@/lib/types'; // Use the Sale type
import { APP_NAME } from '@/lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Define a type for the jspdf instance with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = params.id as string;
  const [sale, setSale] = useState<Sale | undefined | null>(null); // null for loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    if (saleId) {
      setIsLoading(true);
      getSaleByIdAction(saleId)
        .then(fetchedSale => {
          setSale(fetchedSale);
        })
        .catch(err => {
          console.error("Failed to fetch sale details:", err);
          setSale(undefined); // Mark as not found on error
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [saleId]);

  const generateInvoicePDF = () => {
    if (!sale) return;
    setIsGeneratingPdf(true);

    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      let startY = 20;

      // Shop Name
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(APP_NAME, pageWidth / 2, startY, { align: 'center' });
      startY += 10;

      // Invoice Title
      doc.setFontSize(14);
      doc.text("INVOICE", pageWidth / 2, startY, { align: 'center' });
      startY += 10;

      // Sale Details
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


      // Items Table
      const tableColumn = ["Product Name", "Qty", "Unit", "Price/Unit (Rs.)", "Total (Rs.)"];
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
      
      // Get Y position after table
      startY = (doc as any).lastAutoTable.finalY + 10;


      // Grand Total
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Grand Total: Rs. ${sale.totalAmount.toFixed(2)}`, pageWidth - 15, startY, { align: 'right' });
      startY += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (sale.paymentMethod) {
        doc.text(`Payment Method: ${sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}`, pageWidth - 15, startY, { align: 'right' });
        startY += 7;
      }


      // Notes
      if (sale.notes) {
        if (startY > pageHeight - 30) { // Add new page if not enough space
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

      // Thank you message
       if (startY > pageHeight - 20) {
            doc.addPage();
            startY = 20;
        }
      doc.setFontSize(10);
      doc.text("Thank you for your business!", pageWidth / 2, startY, { align: 'center' });

      doc.save(`invoice-${sale.id}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        // Consider adding a user-facing toast notification here
    } finally {
        setIsGeneratingPdf(false);
    }
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
        <Button onClick={generateInvoicePDF} disabled={isGeneratingPdf} className="w-full sm:w-auto">
          {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
          Print Bill
        </Button>
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
    </div>
  );
}
