
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Printer, Eye, Loader2, Edit } from 'lucide-react';
import { getSaleByIdAction, updateSalePaymentStatusAction } from '../actions';
import type { Sale, PaymentTransaction } from '@/lib/types';
import { APP_NAME } from '@/lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { getSession, type SessionData } from '@/app/login/actions';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";


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
  const [sale, setSale] = useState<Sale | null | undefined>(null); // null for initial, undefined for not found
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const { toast } = useToast();

  const [isProcessingA4Pdf, setIsProcessingA4Pdf] = useState(false);
  const [isA4PreviewModalOpen, setIsA4PreviewModalOpen] = useState(false);
  const [a4PreviewPdfUrl, setA4PreviewPdfUrl] = useState<string | null>(null);

  const [isProcessingThermalPdf, setIsProcessingThermalPdf] = useState(false);
  const [isThermalPreviewModalOpen, setIsThermalPreviewModalOpen] = useState(false);
  const [thermalPreviewPdfUrl, setThermalPreviewPdfUrl] = useState<string | null>(null);
  
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setSale(null); // Reset on new fetch
      if (saleId) {
        try {
          const [fetchedSale, currentSession] = await Promise.all([
            getSaleByIdAction(saleId),
            getSession()
          ]);
          setSale(fetchedSale); // Will be Sale object or undefined
          setSession(currentSession);
        } catch (err) {
          console.error("Failed to fetch sale details or session:", err);
          setSale(undefined); 
        }
      } else {
        setSale(undefined); // No ID, so not found
      }
      setIsLoading(false);
    }
    fetchData();
  }, [saleId]);
  
  const currentShopDetails = useMemo((): ShopDetails => {
    return {
      shopName: session?.shopName,
      shopAddress: session?.shopAddress,
      shopContact: session?.shopContact,
    };
  }, [session]);

  const generateInvoicePDF = (outputType: 'save' | 'datauristring' = 'save', options?: PdfOptions): string | void => {
    if (!sale) return;
    if (outputType === 'datauristring') setIsProcessingA4Pdf(true);

    const effectivePrimaryColorHex = options?.primaryColor || session?.invoicePrimaryColor || DEFAULT_INVOICE_COLOR_HEX;
    const headerColorRgb = hexToRgb(effectivePrimaryColorHex) || DEFAULT_INVOICE_COLOR_RGB_ARRAY;

    const shopName = options?.shopDetails?.shopName && options.shopDetails.shopName.trim() !== "" ? options.shopDetails.shopName : APP_NAME;
    const shopAddress = options?.shopDetails?.shopAddress;
    const shopContact = options?.shopDetails?.shopContact;

    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      let startY = 15;
      const leftMargin = 15;
      const rightMargin = pageWidth - 15;

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(shopName, pageWidth / 2, startY, { align: 'center' });
      startY += 7;

      if (shopAddress && shopAddress.trim() !== "") {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(shopAddress, pageWidth - (leftMargin * 2));
        doc.text(addressLines, pageWidth / 2, startY, { align: 'center' });
        startY += (addressLines.length * 4) + 3;
      }

      if (shopContact && shopContact.trim() !== "") {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(shopContact, pageWidth / 2, startY, { align: 'center' });
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
            textColor: [255,255,255],
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

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Total Bill Amount: Rs. ${sale.totalAmount.toFixed(2)}`, rightMargin, startY, { align: 'right' });
      startY += 6;
      doc.setFont(undefined, 'normal');
      doc.text(`Amount Paid: Rs. ${sale.totalPaidAmount.toFixed(2)}`, rightMargin, startY, { align: 'right' });
      startY += 6;
      doc.setFont(undefined, 'bold');
      doc.text(`Amount Due: Rs. ${sale.totalAmountDue.toFixed(2)}`, rightMargin, startY, { align: 'right' });
      startY += 7;

      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      let primaryPaymentMethod = sale.paymentMethod;
      if (!primaryPaymentMethod && sale.paymentHistory.length > 0) {
          const firstPayment = sale.paymentHistory.find(p => p.paymentMethod && p.paymentMethod !== 'manual_adjustment');
          if (firstPayment) primaryPaymentMethod = firstPayment.paymentMethod as Sale['paymentMethod'];
      }
      if (primaryPaymentMethod) {
        doc.text(`Payment Method: ${primaryPaymentMethod.charAt(0).toUpperCase() + primaryPaymentMethod.slice(1)}`, rightMargin, startY, { align: 'right' });
        startY += 10;
      } else {
        startY += 10; 
      }


      if (sale.notes && sale.notes.trim() !== "") {
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
        const dataUri = doc.output('datauristring');
        setIsProcessingA4Pdf(false);
        return dataUri;
      } else {
        doc.save(`invoice-${sale.id}.pdf`);
        setIsProcessingA4Pdf(false);
      }
    } catch (error) {
        console.error("Error generating A4 PDF:", error);
        setIsProcessingA4Pdf(false);
    }
  };

  const generateThermalReceiptPDF = (outputType: 'save' | 'datauristring' = 'save', options?: PdfOptions): string | void => {
    if (!sale) return;
    if (outputType === 'datauristring') setIsProcessingThermalPdf(true);

    const shopName = options?.shopDetails?.shopName && options.shopDetails.shopName.trim() !== "" ? options.shopDetails.shopName : APP_NAME;
    const shopAddress = options?.shopDetails?.shopAddress;
    const shopContact = options?.shopDetails?.shopContact;

    try {
      const thermalWidthMm = 80;
      const thermalWidthPt = thermalWidthMm * (72 / 25.4);
      const marginPt = 8;
      const contentWidthPt = thermalWidthPt - 2 * marginPt;
      const initialPageHeightPt = 800; 

      const doc = new jsPDF({
        unit: 'pt',
        format: [thermalWidthPt, initialPageHeightPt], 
      }) as jsPDFWithAutoTable;

      let currentY = marginPt + 5;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(shopName, thermalWidthPt / 2, currentY, { align: 'center', maxWidth: contentWidthPt });
      currentY += doc.getTextDimensions(shopName, {fontSize: 10, maxWidth: contentWidthPt}).h + 2;


      if (shopAddress && shopAddress.trim() !== "") {
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(shopAddress, contentWidthPt);
        doc.text(addressLines, thermalWidthPt / 2, currentY, { align: 'center' });
        currentY += (addressLines.length * (doc.getTextDimensions('X', {fontSize: 7}).h)) + 2;
      }

      if (shopContact && shopContact.trim() !== "") {
        doc.setFontSize(7);
        doc.setFont(undefined, 'normal');
        doc.text(shopContact, thermalWidthPt / 2, currentY, { align: 'center', maxWidth: contentWidthPt });
        currentY += doc.getTextDimensions(shopContact, {fontSize: 7, maxWidth: contentWidthPt}).h + 4;
      }

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`ID: ${sale.id}`, marginPt, currentY);
      currentY += 10;

      const saleDate = new Date(sale.saleDate);
      const timePartDate = sale.createdAt && (new Date(sale.createdAt).toDateString() === saleDate.toDateString()) 
                         ? new Date(sale.createdAt) 
                         : saleDate;
      doc.text(`Date: ${saleDate.toLocaleDateString()} ${timePartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, marginPt, currentY);
      currentY += 10;

      if (sale.customerName) {
        doc.text(`Customer: ${sale.customerName}`, marginPt, currentY, {maxWidth: contentWidthPt - marginPt });
        currentY += doc.getTextDimensions(sale.customerName, {fontSize: 8, maxWidth: contentWidthPt - marginPt}).h + 2;
      }
      currentY += 3;

      doc.text('-'.repeat(Math.floor(contentWidthPt / (doc.getStringUnitWidth('-') * 8 * 0.9))), thermalWidthPt / 2, currentY, { align: 'center' });
      currentY += 10;

      const tableRows: (string | number)[][] = [];
      sale.items.forEach(item => {
        tableRows.push([
          `${item.productNameSnapshot}`,
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
          cellPadding: {top: 1, right: 1, bottom: 1, left: 1},
          overflow: 'linebreak',
        },
        headStyles: {
          fontSize: 7.5,
          fontStyle: 'bold',
          fillColor: [255,255,255], 
          textColor: [0,0,0], 
          lineWidth: 0.1,
          lineColor: [180,180,180], 
        },
        columnStyles: {
          0: { cellWidth: contentWidthPt * 0.48, fontStyle: 'normal' }, 
          1: { cellWidth: contentWidthPt * 0.12, halign: 'right' },
          2: { cellWidth: contentWidthPt * 0.20, halign: 'right' },
          3: { cellWidth: contentWidthPt * 0.20, halign: 'right' },
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
      doc.setFont(undefined, 'normal');
      doc.text('Total Bill:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalAmount.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 11;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.text('Paid:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalPaidAmount.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 11;

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text('Due:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalAmountDue.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 12;

      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      let primaryPaymentMethod = sale.paymentMethod;
      if (!primaryPaymentMethod && sale.paymentHistory.length > 0) {
          const firstPayment = sale.paymentHistory.find(p => p.paymentMethod && p.paymentMethod !== 'manual_adjustment');
          if (firstPayment) primaryPaymentMethod = firstPayment.paymentMethod as Sale['paymentMethod'];
      }

      if (primaryPaymentMethod) {
        doc.text('Payment:', marginPt, currentY);
        doc.text(primaryPaymentMethod.charAt(0).toUpperCase() + primaryPaymentMethod.slice(1), thermalWidthPt - marginPt, currentY, { align: 'right' });
        currentY += 10;
      } else {
         currentY +=10;
      }

      if (sale.notes && sale.notes.trim() !== "") {
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
        const dataUri = doc.output('datauristring');
        setIsProcessingThermalPdf(false);
        return dataUri;
      } else {
        doc.save(`receipt-${sale.id}.pdf`);
        setIsProcessingThermalPdf(false);
      }
    } catch (error) {
      console.error("Error generating thermal PDF:", error);
      setIsProcessingThermalPdf(false);
    }
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

  const getStatusBadgeVariant = (status: Sale['paymentStatus']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'paid':
        return 'default'; 
      case 'partially_paid':
        return 'secondary';
      case 'unpaid':
        return 'destructive';
      default:
        return 'outline'; 
    }
  };
  
  const handleStatusChange = async (newStatus: Sale['paymentStatus']) => {
    if (!sale) return;
    setIsUpdatingStatus(true);
    
    const payload: UpdateSaleStatusPayload = {
      saleId: sale.id,
      newStatus: newStatus,
      currentTotalAmount: sale.totalAmount,
    };

    const result = await updateSalePaymentStatusAction(payload);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      const updatedSale = await getSaleByIdAction(sale.id);
      setSale(updatedSale);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading sale details...</p>
      </div>
    );
  }

  if (sale === undefined) { 
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
  
  if (sale === null) { 
     return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Initializing...</p>
      </div>
    );
  }

  const displayPaymentMethod = useMemo(() => {
    if (!sale) return 'N/A';
    if (sale.paymentMethod && sale.paymentMethod !== 'manual_adjustment') {
      return sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1);
    }
    const lastNonManualPayment = [...sale.paymentHistory].reverse().find(p => p.paymentMethod && p.paymentMethod !== 'manual_adjustment');
    return lastNonManualPayment?.paymentMethod 
      ? lastNonManualPayment.paymentMethod.charAt(0).toUpperCase() + lastNonManualPayment.paymentMethod.slice(1) 
      : 'N/A';
  }, [sale]);

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
          <Button onClick={handlePreviewA4Bill} disabled={isProcessingA4Pdf || isProcessingThermalPdf || isUpdatingStatus} variant="outline" className="flex-grow sm:flex-grow-0">
            {(isProcessingA4Pdf && a4PreviewPdfUrl === null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview Bill
          </Button>
          <Button onClick={handleDownloadA4Pdf} disabled={isProcessingA4Pdf || isProcessingThermalPdf || isUpdatingStatus} className="flex-grow sm:flex-grow-0">
            {(isProcessingA4Pdf && a4PreviewPdfUrl !== null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button onClick={handlePreviewThermalReceipt} disabled={isProcessingThermalPdf || isProcessingA4Pdf || isUpdatingStatus} variant="outline" className="flex-grow sm:flex-grow-0">
            {(isProcessingThermalPdf && thermalPreviewPdfUrl === null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
            Preview Thermal
          </Button>
          <Button onClick={handleDownloadThermalReceipt} disabled={isProcessingThermalPdf || isProcessingA4Pdf || isUpdatingStatus} className="flex-grow sm:flex-grow-0">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div><strong>Customer:</strong> {sale.customerName || 'N/A'}</div>
            <div><strong>Sale Date:</strong> {new Date(sale.saleDate).toLocaleDateString()}</div>
            <div><strong>Sale Type:</strong> <span className="capitalize">{sale.saleType}</span></div>
            <div>
                <strong>Payment Method:</strong> 
                <span className="capitalize ml-1">{displayPaymentMethod}</span>
            </div>
            <div className="flex items-center gap-2">
              <strong>Status:</strong>
              <Badge variant={getStatusBadgeVariant(sale.paymentStatus)} className="ml-1 capitalize">
                {sale.paymentStatus.replace('_', ' ')}
              </Badge>
              {session?.role === 'owner' && (
                <Select
                  value={sale.paymentStatus}
                  onValueChange={(value) => handleStatusChange(value as Sale['paymentStatus'])}
                  disabled={isUpdatingStatus}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs ml-2" aria-label="Change payment status">
                    {isUpdatingStatus ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Edit className="h-3 w-3 mr-1" />}
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {sale.notes && <div className="md:col-span-full"><strong>Notes:</strong> {sale.notes}</div>}
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="font-medium">Total Bill: <span className="font-semibold">Rs. {sale.totalAmount.toFixed(2)}</span></div>
            <div className="font-medium">Total Paid: <span className="font-semibold text-green-600">Rs. {sale.totalPaidAmount.toFixed(2)}</span></div>
            <div className="font-medium">Amount Due: <span className={cn("font-semibold", sale.totalAmountDue > 0.001 ? "text-destructive" : "text-green-600")}>Rs. {sale.totalAmountDue.toFixed(2)}</span></div>
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
        </CardContent>
      </Card>

      {sale.paymentHistory && sale.paymentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount Paid (Rs.)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {sale.paymentHistory.map((payment, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{new Date(payment.date).toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">{payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground capitalize">{payment.paymentMethod?.replace('_', ' ') || 'N/A'}</td>
                      <td className="px-4 py-2 whitespace-normal text-sm text-muted-foreground max-w-xs truncate" title={payment.notes}>{payment.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}


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

