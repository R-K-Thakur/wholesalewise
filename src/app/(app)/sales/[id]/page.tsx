
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
import { getSession, type SessionData } from '@/app/login/actions';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

const DEFAULT_INVOICE_COLOR_HEX = "#73A7B3"; 
const DEFAULT_INVOICE_COLOR_RGB_ARRAY = [115, 167, 179]; 

interface ShopDetails {
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
}

interface PdfOptions {
  primaryColor?: string;
  shopDetails?: ShopDetails;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

export default function SaleDetailPage() {
  const params = useParams();
  const saleId = params.id as string;
  const [sale, setSale] = useState<Sale | undefined | null>(null); 
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  
  const [isProcessingA4Pdf, setIsProcessingA4Pdf] = useState(false);
  const [isA4PreviewModalOpen, setIsA4PreviewModalOpen] = useState(false);
  const [a4PreviewPdfUrl, setA4PreviewPdfUrl] = useState<string | null>(null);

  const [isProcessingThermalPdf, setIsProcessingThermalPdf] = useState(false);
  const [isThermalPreviewModalOpen, setIsThermalPreviewModalOpen] = useState(false);
  const [thermalPreviewPdfUrl, setThermalPreviewPdfUrl] = useState<string | null>(null);


  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      if (saleId) {
        try {
          const [fetchedSale, currentSession] = await Promise.all([
            getSaleByIdAction(saleId),
            getSession()
          ]);
          setSale(fetchedSale);
          setSession(currentSession);
        } catch (err) {
          console.error("Failed to fetch sale details or session:", err);
          setSale(undefined); 
        }
      }
      setIsLoading(false);
    }
    fetchData();
  }, [saleId]);

  const generateInvoicePDF = (outputType: 'save' | 'datauristring' = 'save', options?: PdfOptions): string | void => {
    if (!sale) return;
    setIsProcessingA4Pdf(true);

    const userPrimaryColorHex = options?.primaryColor || session?.invoicePrimaryColor || DEFAULT_INVOICE_COLOR_HEX;
    const headerColorRgb = hexToRgb(userPrimaryColorHex) || DEFAULT_INVOICE_COLOR_RGB_ARRAY;
    const currentShopName = options?.shopDetails?.shopName || session?.shopName || APP_NAME;
    const currentShopAddress = options?.shopDetails?.shopAddress || session?.shopAddress;
    const currentShopContact = options?.shopDetails?.shopContact || session?.shopContact;

    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      let startY = 15;
      const leftMargin = 15;
      const rightMargin = pageWidth - 15;

      // Shop Name
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(currentShopName, pageWidth / 2, startY, { align: 'center' });
      startY += 7;

      // Shop Address (if available)
      if (currentShopAddress) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(currentShopAddress, pageWidth - (leftMargin * 2));
        doc.text(addressLines, pageWidth / 2, startY, { align: 'center' });
        startY += (addressLines.length * 4) + 3;
      }

      // Shop Contact (if available)
      if (currentShopContact) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(currentShopContact, pageWidth / 2, startY, { align: 'center' });
        startY += 7;
      }

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text("INVOICE", pageWidth / 2, startY, { align: 'center' });
      startY += 10;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      doc.text(`Invoice ID: ${sale.id}`, leftMargin, startY);
      doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString()}`, rightMargin, startY, { align: 'right' });
      startY += 7;

      if (sale.customerName) {
        doc.text(`Customer: ${sale.customerName}`, leftMargin, startY);
        startY += 7;
      }
      
      doc.text(`Sale Type: ${sale.saleType.charAt(0).toUpperCase() + sale.saleType.slice(1)}`, leftMargin, startY);
      startY += 10;

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
        headStyles: { 
            fillColor: headerColorRgb, 
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { halign: 'right' }, 
            2: { halign: 'left' }, 
            3: { halign: 'right' }, 
            4: { halign: 'right' }  
        },
        margin: { top: 10, left: leftMargin, right: leftMargin },
        tableWidth: 'auto', 
        didDrawPage: (data) => {
            startY = data.cursor?.y || 20;
        }
      });
      
      startY = (doc as any).lastAutoTable.finalY + 12; 

      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text(`Grand Total: Rs. ${sale.totalAmount.toFixed(2)}`, rightMargin, startY, { align: 'right' });
      startY += 7;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      if (sale.paymentMethod) {
        doc.text(`Payment Method: ${sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}`, rightMargin, startY, { align: 'right' });
        startY += 10;
      }

      if (sale.notes) {
        if (startY > pageHeight - 40) { 
            doc.addPage();
            startY = 20;
        }
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Notes:", leftMargin, startY);
        startY += 5;
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(sale.notes, rightMargin - leftMargin);
        doc.text(splitNotes, leftMargin, startY);
        startY += (splitNotes.length * 5) + 10; 
      }

      if (startY > pageHeight - 20) { 
            doc.addPage();
            startY = 20;
      }
      doc.setFontSize(10);
      doc.text("Thank you for your business!", pageWidth / 2, pageHeight - 15, { align: 'center' });


      if (outputType === 'datauristring') {
        return doc.output('datauristring');
      } else {
        doc.save(`invoice-${sale.id}.pdf`);
      }
    } catch (error) {
        console.error("Error generating A4 PDF:", error);
    } finally {
        setIsProcessingA4Pdf(false);
    }
  };

  const generateThermalReceiptPDF = (outputType: 'save' | 'datauristring' = 'save', options?: PdfOptions): string | void => {
    if (!sale) return;
    setIsProcessingThermalPdf(true);

    const currentShopName = options?.shopDetails?.shopName || session?.shopName || APP_NAME;
    const currentShopAddress = options?.shopDetails?.shopAddress || session?.shopAddress;
    const currentShopContact = options?.shopDetails?.shopContact || session?.shopContact;


    try {
      const thermalWidthMm = 80;
      const thermalWidthPt = thermalWidthMm * (72 / 25.4); 
      const marginPt = 8; // Reduced margin slightly for more content space
      const contentWidthPt = thermalWidthPt - 2 * marginPt;
      const initialPageHeightPt = 800; 

      const doc = new jsPDF({
        unit: 'pt',
        format: [thermalWidthPt, initialPageHeightPt],
      }) as jsPDFWithAutoTable;

      let currentY = marginPt + 5;

      // Shop Name
      doc.setFontSize(10); // Slightly smaller for thermal
      doc.setFont(undefined, 'bold');
      doc.text(currentShopName, thermalWidthPt / 2, currentY, { align: 'center', maxWidth: contentWidthPt });
      currentY += doc.getTextDimensions(currentShopName, {fontSize: 10, maxWidth: contentWidthPt}).h + 2;


      // Shop Address (if available) - smaller font
      if (currentShopAddress) {
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(currentShopAddress, contentWidthPt);
        doc.text(addressLines, thermalWidthPt / 2, currentY, { align: 'center' });
        currentY += (addressLines.length * (doc.getTextDimensions('X', {fontSize: 7}).h)) + 2;
      }

      // Shop Contact (if available) - smaller font
      if (currentShopContact) {
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(currentShopContact, thermalWidthPt / 2, currentY, { align: 'center', maxWidth: contentWidthPt });
        currentY += doc.getTextDimensions(currentShopContact, {fontSize: 7, maxWidth: contentWidthPt}).h + 4;
      }
      
      // Sale Info
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`ID: ${sale.id}`, marginPt, currentY);
      currentY += 10;
      
      const saleDate = new Date(sale.saleDate);
      const saleTime = new Date(sale.createdAt); 
      doc.text(`Date: ${saleDate.toLocaleDateString()} ${saleTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, marginPt, currentY);
      currentY += 10;

      if (sale.customerName) {
        doc.text(`Customer: ${sale.customerName}`, marginPt, currentY, {maxWidth: contentWidthPt - marginPt });
        currentY += doc.getTextDimensions(sale.customerName, {fontSize: 8, maxWidth: contentWidthPt - marginPt}).h + 2;
      }
      currentY += 3; 

      // Separator
      doc.text('-'.repeat(Math.floor(contentWidthPt / (doc.getStringUnitWidth('-') * 8 * 0.9))), thermalWidthPt / 2, currentY, { align: 'center' });
      currentY += 10;

      // Items Table
      const tableRows: (string | number)[][] = [];
      sale.items.forEach(item => {
        tableRows.push([
          `${item.productNameSnapshot}`, // productName might wrap
          item.quantitySold,
          item.pricePerUnitSold.toFixed(2),
          item.total.toFixed(2)
        ]);
      });

      autoTable(doc, {
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: tableRows,
        startY: currentY,
        theme: 'plain',
        styles: {
          fontSize: 7,
          cellPadding: {top: 1, right: 1, bottom: 1, left: 1}, // Tighter padding
          overflow: 'linebreak',
        },
        headStyles: {
          fontSize: 7.5, // Slightly smaller head
          fontStyle: 'bold',
          fillColor: [255,255,255], 
          textColor: [0,0,0],
          lineWidth: 0.1,
          lineColor: [180,180,180], 
        },
        columnStyles: {
          0: { cellWidth: contentWidthPt * 0.48, fontStyle: 'normal' }, // Item (more space)
          1: { cellWidth: contentWidthPt * 0.12, halign: 'right' }, // Qty (less space)
          2: { cellWidth: contentWidthPt * 0.20, halign: 'right' }, // Price
          3: { cellWidth: contentWidthPt * 0.20, halign: 'right' }, // Total
        },
        margin: { left: marginPt, right: marginPt },
        tableWidth: 'auto',
        didDrawPage: (data) => {
          currentY = data.cursor?.y || currentY;
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;

      doc.text('-'.repeat(Math.floor(contentWidthPt / (doc.getStringUnitWidth('-') * 8 * 0.9))), thermalWidthPt / 2, currentY, { align: 'center' });
      currentY += 10;

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Grand Total:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalAmount.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 12;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      if (sale.paymentMethod) {
        doc.text('Payment Method:', marginPt, currentY);
        doc.text(sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1), thermalWidthPt - marginPt, currentY, { align: 'right' });
        currentY += 10;
      }

      if (sale.notes) {
        currentY += 3;
        doc.setFont(undefined, 'bold');
        doc.text("Notes:", marginPt, currentY);
        currentY += 8;
        doc.setFont(undefined, 'normal');
        const splitNotes = doc.splitTextToSize(sale.notes, contentWidthPt);
        doc.text(splitNotes, marginPt, currentY);
        currentY += (splitNotes.length * 8) + 3;
      }
      
      currentY += 8;
      doc.setFontSize(8);
      doc.text("Thank you for your business!", thermalWidthPt / 2, currentY, { align: 'center', maxWidth: contentWidthPt });
      currentY += 12;
      doc.text("***", thermalWidthPt / 2, currentY, { align: 'center' });


      if (outputType === 'datauristring') {
        return doc.output('datauristring');
      } else {
        doc.save(`receipt-${sale.id}.pdf`);
      }
    } catch (error) {
      console.error("Error generating thermal PDF:", error);
    } finally {
      setIsProcessingThermalPdf(false);
    }
  };
  
  const currentShopDetails: ShopDetails = {
    shopName: session?.shopName,
    shopAddress: session?.shopAddress,
    shopContact: session?.shopContact,
  };

  const handlePreviewA4Bill = () => {
    const dataUri = generateInvoicePDF('datauristring', { primaryColor: session?.invoicePrimaryColor, shopDetails: currentShopDetails });
    if (dataUri) {
      setA4PreviewPdfUrl(dataUri);
      setIsA4PreviewModalOpen(true);
    }
  };

  const handleDownloadA4Pdf = () => {
    generateInvoicePDF('save', { primaryColor: session?.invoicePrimaryColor, shopDetails: currentShopDetails });
  };

  const handlePreviewThermalReceipt = () => {
    const dataUri = generateThermalReceiptPDF('datauristring', { shopDetails: currentShopDetails });
    if (dataUri) {
      setThermalPreviewPdfUrl(dataUri);
      setIsThermalPreviewModalOpen(true);
    }
  };

  const handleDownloadThermalReceipt = () => {
    generateThermalReceiptPDF('save', { shopDetails: currentShopDetails });
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
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button onClick={handlePreviewA4Bill} disabled={isProcessingA4Pdf || isProcessingThermalPdf} variant="outline" className="flex-grow sm:flex-grow-0">
            {(isProcessingA4Pdf && a4PreviewPdfUrl === null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview Bill
          </Button>
          <Button onClick={handleDownloadA4Pdf} disabled={isProcessingA4Pdf || isProcessingThermalPdf} className="flex-grow sm:flex-grow-0">
            {(isProcessingA4Pdf && a4PreviewPdfUrl !== null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={handlePreviewThermalReceipt} disabled={isProcessingThermalPdf || isProcessingA4Pdf} variant="outline" className="flex-grow sm:flex-grow-0">
            {(isProcessingThermalPdf && thermalPreviewPdfUrl === null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview Thermal
          </Button>
          <Button onClick={handleDownloadThermalReceipt} disabled={isProcessingThermalPdf || isProcessingA4Pdf} className="flex-grow sm:flex-grow-0">
            {(isProcessingThermalPdf && thermalPreviewPdfUrl !== null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Download Thermal
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

      <Dialog open={isA4PreviewModalOpen} onOpenChange={setIsA4PreviewModalOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Invoice Preview (A4)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-0 m-0 overflow-hidden">
            {a4PreviewPdfUrl ? (
              <iframe
                src={a4PreviewPdfUrl}
                width="100%"
                height="100%"
                className="border-0"
                title="A4 Invoice Preview"
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

      <Dialog open={isThermalPreviewModalOpen} onOpenChange={setIsThermalPreviewModalOpen}>
        <DialogContent className="max-w-xs sm:max-w-sm md:max-w-md h-[80vh] flex flex-col p-0"> 
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Thermal Receipt Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-0 m-0 overflow-hidden">
            {thermalPreviewPdfUrl ? (
              <iframe
                src={thermalPreviewPdfUrl}
                width="100%"
                height="100%"
                className="border-0"
                title="Thermal Receipt Preview"
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

    
