
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { ArrowLeft, Printer, Eye, Loader2, Edit, PlusCircle, UserCircle, QrCode, Pencil, FileText } from 'lucide-react';
import { getSaleByIdAction, updateSalePaymentStatusAction, recordAdditionalPaymentAction, type UpdateSaleStatusPayload, updateSaleCustomerNameAction } from '../actions';
import type { Sale, PaymentTransaction, RecordAdditionalPaymentPayload } from '@/lib/types';
import { APP_NAME } from '@/lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSession, type SessionData } from '@/app/login/actions';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDFWithAutoTable;
}

const EPSILON = 0.001; // For floating point comparisons

type DocumentType = 'Invoice' | 'Estimate' | 'Quotation';


interface ShopDetails {
  shopName?: string;
  shopAddress?: string;
  shopContact?: string;
  invoicePrimaryColor?: string;
}

interface PdfOptions {
  shopDetails?: ShopDetails;
  documentType?: DocumentType;
}


export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;
  const [sale, setSale] = useState<Sale | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<SessionData | null>(null);
  const { toast } = useToast();

  const [documentType, setDocumentType] = useState<DocumentType>('Invoice');

  const [isProcessingA4Pdf, setIsProcessingA4Pdf] = useState(false);
  const [isA4PreviewModalOpen, setIsA4PreviewModalOpen] = useState(false);
  const [a4PreviewPdfUrl, setA4PreviewPdfUrl] = useState<string | null>(null);

  const [isProcessingThermalPdf, setIsProcessingThermalPdf] = useState(false);
  const [isThermalPreviewModalOpen, setIsThermalPreviewModalOpen] = useState(false);
  const [thermalPreviewPdfUrl, setThermalPreviewPdfUrl] = useState<string | null>(null);

  const [isProcessingA4Thermal, setIsProcessingA4Thermal] = useState(false);

  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>('cash');
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  const [isEditCustomerNameDialogOpen, setIsEditCustomerNameDialogOpen] = useState(false);
  const [editingCustomerName, setEditingCustomerName] = useState("");
  const [isSubmittingCustomerName, setIsSubmittingCustomerName] = useState(false);

  const [pageUrlForQr, setPageUrlForQr] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrlForQr(window.location.href);
    }
  }, [saleId]);


  const displayPaymentMethod = useMemo(() => {
    if (!sale) return 'N/A';
    const reversedHistory = [...(sale.paymentHistory || [])].reverse();
    const lastConcretePayment = reversedHistory.find(p => p.paymentMethod && p.paymentMethod !== 'manual_adjustment');

    if (lastConcretePayment?.paymentMethod) {
      return lastConcretePayment.paymentMethod.charAt(0).toUpperCase() + lastConcretePayment.paymentMethod.slice(1);
    }
    if (sale.paymentMethod && sale.paymentMethod !== 'manual_adjustment') {
      return sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1);
    }
    return sale.paymentMethod ? sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1) : 'N/A';
  }, [sale]);


  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setSale(null);
      if (saleId) {
        try {
          const [fetchedSale, currentSession] = await Promise.all([
            getSaleByIdAction(saleId),
            getSession()
          ]);
          setSale(fetchedSale);
          setSession(currentSession);
          if (fetchedSale) {
            setEditingCustomerName(fetchedSale.customerName || "");
            if (fetchedSale.totalAmountDue > EPSILON) {
              setPaymentAmount(fetchedSale.totalAmountDue.toFixed(2));
            } else {
              setPaymentAmount("");
            }
          }
        } catch (err) {
          console.error("Failed to fetch sale details or session:", err);
          setSale(undefined);
        }
      } else {
        setSale(undefined);
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
      invoicePrimaryColor: session?.invoicePrimaryColor,
    };
  }, [session]);

  const canEditCustomerName = useMemo(() => {
    if (!sale || !session) return false;
    if (session.role === 'owner') return true;
    if (session.role === 'staff') {
      return sale.customerNameInitiallyEmpty === true && (sale.staffMadeInitialEdit === false || sale.staffMadeInitialEdit === undefined);
    }
    return false;
  }, [sale, session]);


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

  const generateInvoicePDF = (outputType: 'save' | 'datauristring' = 'save', options?: PdfOptions): string | void => {
    if (!sale) return;
    if (outputType === 'datauristring') setIsProcessingA4Pdf(true);

    const shopName = options?.shopDetails?.shopName || APP_NAME;
    const shopAddress = options?.shopDetails?.shopAddress;
    const shopContact = options?.shopDetails?.shopContact;
    const accentColor = options?.shopDetails?.invoicePrimaryColor || "#73A7B3"; // Default Muted Teal
    const docType = options?.documentType || 'Invoice';


    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" }) as jsPDFWithAutoTable;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - 2 * margin;
      const contentBottomLimit = pageHeight - margin; 

      let currentY = margin;

      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(shopName.toUpperCase(), margin, currentY);
      currentY += 18;

      if (shopAddress) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        const addressLines = doc.splitTextToSize(shopAddress, contentWidth * 0.7);
        doc.text(addressLines, margin, currentY);
        currentY += (addressLines.length * 10) + 4;
      }

      if (shopContact) {
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(shopContact, margin, currentY);
        currentY += 14;
      }
      currentY += 5;

      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(docType.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
      currentY += 28;

      const detailsStartY = currentY;
      const halfContentWidth = contentWidth / 2;
      const detailRowHeight = 14;
      const labelWidth = 70;

      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text("BILL TO:", margin, currentY);
      currentY += detailRowHeight;
      doc.setFont(undefined, 'normal');
      doc.text(sale.customerName || "N/A", margin, currentY, { maxWidth: halfContentWidth - 15 });
      
      let tempY = detailsStartY;
      const invoiceDetailsX = margin + halfContentWidth + 20;

      const addDetailRow = (label: string, value: string) => {
        doc.setFont(undefined, 'bold');
        doc.text(label, invoiceDetailsX, tempY);
        doc.setFont(undefined, 'normal');
        doc.text(value, invoiceDetailsX + labelWidth, tempY, { maxWidth: halfContentWidth - labelWidth - 25 });
        tempY += detailRowHeight;
      };
      
      addDetailRow(`${docType} No:`, sale.id.substring(0, 12).toUpperCase());
      const invoiceDateTime = sale.createdAt ? new Date(sale.createdAt) : new Date(sale.saleDate);
      addDetailRow("Date:", format(invoiceDateTime, "dd/MM/yyyy"));
      addDetailRow("Time:", format(invoiceDateTime, "HH:mm:ss"));
      addDetailRow("Salesman:", sale.recordedByName || sale.recordedByEmail || "N/A");
      
      currentY = Math.max(currentY + detailRowHeight, tempY) + 5;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 20;

      const tableColumns = ["#", "Item Description", "Qty", "Unit", "Rate (Rs.)", "Amount (Rs.)"];
      const tableRows: (string | number)[][] = [];
      sale.items.forEach((item, index) => {
        tableRows.push([
          index + 1,
          item.productNameSnapshot,
          item.quantitySold.toFixed(2),
          item.soldUnit.toUpperCase(),
          item.pricePerUnitSold.toFixed(2),
          item.total.toFixed(2)
        ]);
      });

      const addNewPageIfNeeded = (estimatedHeightOfNextBlock: number) => {
        if (currentY + estimatedHeightOfNextBlock > contentBottomLimit) {
          doc.addPage();
          currentY = margin;
        }
      };

      autoTable(doc, {
        head: [tableColumns],
        body: tableRows,
        startY: currentY,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: { top: 5, right: 6, bottom: 5, left: 6 }, valign: 'middle', overflow: 'linebreak', lineWidth: 0.2, lineColor: [200, 200, 200] },
        headStyles: { fillColor: accentColor, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { halign: 'center', cellWidth: 30 }, 1: { halign: 'left', cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 45 }, 3: { halign: 'center', cellWidth: 45 }, 4: { halign: 'right', cellWidth: 70 }, 5: { halign: 'right', cellWidth: 80 } },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: margin, right: margin },
        tableLineColor: [180, 180, 180],
        tableLineWidth: 0.5,
        autoPaging: true, 
        didDrawPage: (data) => {
            if (data.pageNumber > 1) { 
                currentY = margin;
            }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 20; 
      
      const totalRowHeightInner = 15; 
      const totalsBlockWidth = 220;
      const totalsX = pageWidth - margin - totalsBlockWidth;
      const valueColX = pageWidth - margin;
      const numTotalLines = 6; 
      const estTotalsHeight = (numTotalLines * totalRowHeightInner) + 30; 
      addNewPageIfNeeded(estTotalsHeight);
      
      const drawTotalRowInner = (label: string, value: string | number, isBold: boolean = false, isEmphasized: boolean = false) => {
        doc.setFont(undefined, isBold ? 'bold' : 'normal');
        doc.setFontSize(isEmphasized ? 11 : 10);
        doc.text(label, totalsX, currentY);
        doc.text(typeof value === 'number' ? `Rs. ${value.toFixed(2)}` : value, valueColX, currentY, { align: 'right' });
        currentY += totalRowHeightInner;
      };

      const itemsSubtotal = sale.items.reduce((sum, item) => sum + item.total, 0);
      drawTotalRowInner("Subtotal:", itemsSubtotal);
      if (sale.packagingCharges && sale.packagingCharges > 0) drawTotalRowInner("Packaging Chrgs:", sale.packagingCharges);
      if (sale.transportCharges && sale.transportCharges > 0) drawTotalRowInner("Transport Chrgs:", sale.transportCharges);
      currentY += 2;
      doc.setDrawColor(150, 150, 150);
      doc.line(totalsX, currentY, valueColX, currentY);
      currentY += 8; 
      drawTotalRowInner("GRAND TOTAL:", sale.totalAmount, true, true);
      currentY += 5;
      drawTotalRowInner("Amount Paid:", sale.totalPaidAmount);
      drawTotalRowInner("Amount Due:", sale.totalAmountDue, sale.totalAmountDue > EPSILON, sale.totalAmountDue > EPSILON);
      currentY += 5; 

      const amountInWordsText = `Rupee ${sale.totalAmount.toFixed(2)} only`;
      const amountInWordsLines = doc.splitTextToSize(amountInWordsText, contentWidth - totalsBlockWidth - 30); 
      const estAmountInWordsHeight = (amountInWordsLines.length * 10) + 20;
      addNewPageIfNeeded(estAmountInWordsHeight); 

      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      doc.text("Amount:", margin, currentY);
      currentY += 12;
      doc.setFont(undefined, 'normal');
      doc.text(amountInWordsLines, margin, currentY);
      currentY += (amountInWordsLines.length * 10) + 10;

      const terms = ["- Goods once sold will not be taken back or exchanged.", "- All disputes subject to local jurisdiction only."];
      const estTermsHeight = (terms.length * 10) + 10;
      const estSigHeight = 50;
      const finalBlockHeight = estTermsHeight + estSigHeight + 30; 
      addNewPageIfNeeded(finalBlockHeight);

      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text("Terms & Conditions:", margin, currentY);
      currentY += 10;
      doc.setFont(undefined, 'normal');
      terms.forEach(term => {
        doc.text(term, margin, currentY);
        currentY += 10;
      });
      currentY += 10; 

      const finalSigLineY = currentY + 20;
      doc.setDrawColor(100, 100, 100);
      doc.line(totalsX, finalSigLineY, pageWidth - margin, finalSigLineY);
      let sigTextY = finalSigLineY + 12;
      doc.setFontSize(9);
      doc.text("For " + shopName.toUpperCase(), totalsX + ((pageWidth - margin - totalsX) / 2), sigTextY, { align: 'center' });
      sigTextY += 12;
      doc.text("Authorized Signatory", totalsX + ((pageWidth - margin - totalsX) / 2), sigTextY, { align: 'center' });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - (margin / 2) - 5, { align: 'center' });
        if (i === pageCount) {
          doc.text(`Tally by: ${sale.recordedByName || sale.recordedByEmail || "N/A"}`, margin, pageHeight - (margin / 2) - 5);
        }
      }

      if (outputType === 'datauristring') {
        const dataUri = doc.output('datauristring');
        setIsProcessingA4Pdf(false);
        return dataUri;
      } else {
        doc.save(`${docType}-${sale.id}.pdf`);
        setIsProcessingA4Pdf(false);
      }
    } catch (error) {
        console.error("Error generating A4 PDF:", error);
        toast({ title: "Error Generating PDF", description: "Could not generate A4 invoice.", variant: "destructive" });
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
      const initialPageHeightPt = 800; 

      const doc = new jsPDF({
        unit: 'pt',
        format: [thermalWidthPt, initialPageHeightPt],
      }) as jsPDFWithAutoTable;
      
      const marginPt = 8;
      const contentWidthPt = thermalWidthPt - 2 * marginPt;
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
      doc.text(`ID: ${sale.id.substring(0,10)}...`, marginPt, currentY);
      currentY += 10;

      const saleDate = new Date(sale.saleDate);
      const timePartDate = sale.createdAt && (new Date(sale.createdAt).toDateString() === saleDate.toDateString())
                         ? new Date(sale.createdAt)
                         : saleDate;
      doc.text(`Date: ${saleDate.toLocaleDateString()} ${timePartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, marginPt, currentY);
      currentY += 10;

      if (sale.customerName) {
        doc.text(`Cust: ${sale.customerName}`, marginPt, currentY, {maxWidth: contentWidthPt - marginPt }); 
        currentY += doc.getTextDimensions(sale.customerName, {fontSize: 8, maxWidth: contentWidthPt - marginPt}).h + 2;
      }

      const recordedByText = sale.recordedByName || sale.recordedByEmail;
      if (recordedByText) {
        doc.text(`By: ${recordedByText}`, marginPt, currentY, {maxWidth: contentWidthPt});
        currentY += doc.getTextDimensions(`By: ${recordedByText}`, {fontSize: 8, maxWidth: contentWidthPt}).h + 2;
      }
      currentY += 3; 

      doc.text('-'.repeat(Math.floor(contentWidthPt / (doc.getStringUnitWidth('-') * 8 * 0.9))), thermalWidthPt / 2, currentY, { align: 'center' });
      currentY += 10;

      const tableRows: (string | number)[][] = [];
      sale.items.forEach((item, index) => {
        tableRows.push([
          index + 1,
          `${item.productNameSnapshot}`, 
          item.quantitySold,
          item.pricePerUnitSold.toFixed(2),
          item.total.toFixed(2)
        ]);
      });

      autoTable(doc, {
        head: [['#', 'Item', 'Qty', 'Rate', 'Total']],
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
          0: { cellWidth: contentWidthPt * 0.08, halign: 'center' },
          1: { cellWidth: contentWidthPt * 0.40, fontStyle: 'normal' }, 
          2: { cellWidth: contentWidthPt * 0.12, halign: 'right' }, 
          3: { cellWidth: contentWidthPt * 0.20, halign: 'right' }, 
          4: { cellWidth: contentWidthPt * 0.20, halign: 'right' }, 
        },
        margin: { left: marginPt, right: marginPt },
        tableWidth: 'auto', 
      });
      currentY = (doc as any).lastAutoTable.finalY + 5; 

      doc.text('-'.repeat(Math.floor(contentWidthPt / (doc.getStringUnitWidth('-') * 8 * 0.9))), thermalWidthPt / 2, currentY, { align: 'center' });
      currentY += 10;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');

      const itemsSubtotal = sale.items.reduce((sum, item) => sum + item.total, 0);
      doc.text('Subtotal:', marginPt, currentY);
      doc.text(`Rs. ${itemsSubtotal.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 11;

      if (sale.packagingCharges && sale.packagingCharges > 0) {
        doc.text('Packaging:', marginPt, currentY);
        doc.text(`Rs. ${sale.packagingCharges.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
        currentY += 11;
      }
      if (sale.transportCharges && sale.transportCharges > 0) {
        doc.text('Transport:', marginPt, currentY);
        doc.text(`Rs. ${sale.transportCharges.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
        currentY += 11;
      }


      doc.setFont(undefined, 'bold');
      doc.text('Total Bill:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalAmount.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 11;
      doc.setFont(undefined, 'normal');

      doc.text('Paid:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalPaidAmount.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 11;

      doc.setFont(undefined, 'bold');
      doc.text('Due:', marginPt, currentY);
      doc.text(`Rs. ${sale.totalAmountDue.toFixed(2)}`, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 12; 
      doc.setFont(undefined, 'normal');

      doc.setFontSize(8);
      doc.text('Payment:', marginPt, currentY);
      doc.text(displayPaymentMethod, thermalWidthPt - marginPt, currentY, { align: 'right' });
      currentY += 10;

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
      toast({ title: "Error Generating PDF", description: "Could not generate thermal receipt.", variant: "destructive" });
      setIsProcessingThermalPdf(false);
    }
  };

  const generateA4MultiReceiptPDF = (options?: PdfOptions) => {
    if (!sale) return;
    setIsProcessingA4Thermal(true);
    
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }) as jsPDFWithAutoTable;
    const pageA4Width = doc.internal.pageSize.getWidth();
    const pageA4Height = doc.internal.pageSize.getHeight();
    
    const columnWidth = pageA4Width / 3;
    const topMargin = 35;
    const sideMargin = 20;
    const contentWidth = columnWidth - (2 * sideMargin);
    const contentHeight = pageA4Height - topMargin - 35;
    
    const drawReceiptInColumn = (colIndex: number) => {
        let currentX = sideMargin + (colIndex * columnWidth);
        let currentY = topMargin;
    
        // Draw Header
        const shopName = options?.shopDetails?.shopName || APP_NAME;
        const shopAddress = options?.shopDetails?.shopAddress;
        const shopContact = options?.shopDetails?.shopContact;

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        const shopNameLines = doc.splitTextToSize(shopName, contentWidth);
        doc.text(shopNameLines, currentX + contentWidth / 2, currentY, { align: 'center' });
        currentY += (shopNameLines.length * 12);
        
        if (shopAddress) {
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            const addressLines = doc.splitTextToSize(shopAddress, contentWidth);
            doc.text(addressLines, currentX + contentWidth / 2, currentY, { align: 'center' });
            currentY += (addressLines.length * 8) + 2;
        }
        if (shopContact) {
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(shopContact, currentX + contentWidth / 2, currentY, { align: 'center', maxWidth: contentWidth });
            currentY += 10;
        }
        
        currentY += 5;
        doc.setLineDashPattern([2, 2], 0);
        doc.line(currentX, currentY, currentX + contentWidth, currentY);
        doc.setLineDashPattern([], 0);
        currentY += 10;
        
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date(sale.saleDate);
        doc.text(`ID: ${sale.id}`, currentX, currentY);
        currentY += 10;
        doc.text(`Date: ${format(saleDate, "dd/MM/yyyy hh:mm a")}`, currentX, currentY);
        currentY += 10;
        if (sale.customerName) {
            doc.text(`Cust: ${sale.customerName}`, currentX, currentY, { maxWidth: contentWidth });
            currentY += 10;
        }
        doc.text(`By: ${sale.recordedByName || sale.recordedByEmail || 'N/A'}`, currentX, currentY);
        currentY += 12;

        // Draw Table
        const tableHead = [['#', 'Item', 'Qty', 'Rate', 'Total']];
        const tableBody = sale.items.map((item, index) => [
            (index + 1).toString(),
            item.productNameSnapshot,
            item.quantitySold.toString(),
            item.pricePerUnitSold.toFixed(2),
            item.total.toFixed(2)
        ]);

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: currentY,
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: {top:1, bottom:1, left: 2, right: 2}, overflow: 'linebreak' },
            headStyles: { fontStyle: 'bold', halign: 'center', fontSize: 8.5, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: contentWidth * 0.08, halign: 'center' },
                1: { cellWidth: contentWidth * 0.42, halign: 'left' },
                2: { cellWidth: contentWidth * 0.15, halign: 'right' },
                3: { cellWidth: contentWidth * 0.17, halign: 'right' },
                4: { cellWidth: contentWidth * 0.18, halign: 'right' },
            },
            margin: { left: currentX, right: pageA4Width - (currentX + contentWidth) },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
        
        // Draw Footer
        doc.setLineDashPattern([2, 2], 0);
        doc.line(currentX, currentY, currentX + contentWidth, currentY);
        doc.setLineDashPattern([], 0);
        currentY += 12;

        doc.setFontSize(9);
        const totalsX = currentX;
        const valuesX = currentX + contentWidth;

        const itemsSubtotal = sale.items.reduce((sum, item) => sum + item.total, 0);
        doc.setFont(undefined, 'normal');
        doc.text('Subtotal:', totalsX, currentY); doc.text(`Rs. ${itemsSubtotal.toFixed(2)}`, valuesX, currentY, { align: 'right' });
        currentY += 11;
        
        if (sale.packagingCharges && sale.packagingCharges > 0) {
            doc.text('Packaging:', totalsX, currentY); doc.text(`Rs. ${sale.packagingCharges.toFixed(2)}`, valuesX, currentY, { align: 'right' });
            currentY += 11;
        }
        if (sale.transportCharges && sale.transportCharges > 0) {
            doc.text('Transport:', totalsX, currentY); doc.text(`Rs. ${sale.transportCharges.toFixed(2)}`, valuesX, currentY, { align: 'right' });
            currentY += 11;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text('Total Bill:', totalsX, currentY); doc.text(`Rs. ${sale.totalAmount.toFixed(2)}`, valuesX, currentY, { align: 'right' });
        currentY += 11;
        doc.setFont(undefined, 'normal');

        doc.text('Paid:', totalsX, currentY); doc.text(`Rs. ${sale.totalPaidAmount.toFixed(2)}`, valuesX, currentY, { align: 'right' });
        currentY += 11;
        
        doc.setFont(undefined, 'bold');
        doc.text('Due:', totalsX, currentY); doc.text(`Rs. ${sale.totalAmountDue.toFixed(2)}`, valuesX, currentY, { align: 'right' });
        currentY += 12;
        doc.setFont(undefined, 'normal');
        
        doc.setFontSize(8);
        doc.text('Payment:', totalsX, currentY); doc.text(displayPaymentMethod, valuesX, currentY, { align: 'right' });
        currentY += 12;

        if (sale.notes && sale.notes.trim() !== "") {
            const notesLines = doc.splitTextToSize(sale.notes, contentWidth);
            doc.setFont(undefined, 'bold');
            doc.text("Notes:", totalsX, currentY);
            currentY += 10;
            doc.setFont(undefined, 'normal');
            doc.text(notesLines, totalsX, currentY);
            currentY += (notesLines.length * 8) + 5;
        }
        
        doc.setFontSize(8);
        doc.text("Thank you for your business!", currentX + contentWidth/2, currentY, { align: 'center' });
        currentY += 12;
        doc.text("***", currentX + contentWidth/2, currentY, { align: 'center' });
    };

    try {
        drawReceiptInColumn(0);
        drawReceiptInColumn(1);
        drawReceiptInColumn(2);
        
        doc.setLineDashPattern([2, 1], 0);
        doc.setDrawColor(180, 180, 180);
        doc.line(columnWidth, topMargin - 10, columnWidth, pageA4Height - topMargin + 10);
        doc.line(columnWidth * 2, topMargin - 10, columnWidth * 2, pageA4Height - topMargin + 10);
        doc.setLineDashPattern([], 0);

        doc.save(`A4-thermal-bill-${sale.id}.pdf`);
    } catch (error) {
      console.error("Error generating A4 multi-column PDF:", error);
      toast({ title: "Error Generating PDF", description: "Could not generate A4 thermal-style bill.", variant: "destructive" });
    } finally {
      setIsProcessingA4Thermal(false);
    }
  };


  const handlePreviewA4Bill = () => {
    const dataUri = generateInvoicePDF('datauristring', { shopDetails: currentShopDetails, documentType });
    if (dataUri) {
      setA4PreviewPdfUrl(dataUri);
      setIsA4PreviewModalOpen(true);
    }
  };

  const handleDownloadA4Pdf = () => {
    generateInvoicePDF('save', { shopDetails: currentShopDetails, documentType });
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

  const handleGenerateA4ThermalLayout = () => {
    generateA4MultiReceiptPDF({ shopDetails: currentShopDetails });
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
      if (updatedSale) {
        setEditingCustomerName(updatedSale.customerName || "");
        if (updatedSale.totalAmountDue > EPSILON) {
          setPaymentAmount(updatedSale.totalAmountDue.toFixed(2));
        } else {
          setPaymentAmount("");
        }
      }
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsUpdatingStatus(false);
  };

  const handleRecordAdditionalPaymentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sale || !paymentAmount) return;

    const amountPaidNum = parseFloat(paymentAmount);
    if (isNaN(amountPaidNum) || amountPaidNum <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a valid positive amount.", variant: "destructive" });
      return;
    }
    if (amountPaidNum > sale.totalAmountDue + EPSILON) {
      toast({ title: "Overpayment", description: `Payment (Rs. ${amountPaidNum.toFixed(2)}) exceeds amount due (Rs. ${sale.totalAmountDue.toFixed(2)}).`, variant: "destructive" });
      return;
    }

    setIsSubmittingPayment(true);
    const payload: RecordAdditionalPaymentPayload = {
      saleId: sale.id,
      amountPaidNow: amountPaidNum,
      paymentMethod: paymentMethod as Sale['paymentMethod'],
      paymentNotes: paymentNotes.trim() === "" ? undefined : paymentNotes.trim(),
    };

    const result = await recordAdditionalPaymentAction(payload);
    if (result.success) {
      toast({ title: "Payment Recorded", description: result.message });
      setIsRecordPaymentDialogOpen(false);

      setPaymentAmount("");
      setPaymentMethod('cash');
      setPaymentNotes("");

      const updatedSale = await getSaleByIdAction(sale.id);
      setSale(updatedSale);
      if (updatedSale) {
        setEditingCustomerName(updatedSale.customerName || "");
        if (updatedSale.totalAmountDue > EPSILON) {
          setPaymentAmount(updatedSale.totalAmountDue.toFixed(2));
        } else {
          setPaymentAmount("");
        }
      }
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingPayment(false);
  };

  const handleEditCustomerNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sale) return;
    if (!editingCustomerName.trim() && sale.customerName) {
        toast({ title: "Customer Name Required", description: "Customer name cannot be empty if it was previously set.", variant: "destructive" });
        return;
    }
    if (editingCustomerName.trim() === (sale.customerName || "")) {
        setIsEditCustomerNameDialogOpen(false);
        return;
    }

    setIsSubmittingCustomerName(true);
    const result = await updateSaleCustomerNameAction(sale.id, editingCustomerName.trim());
    if (result.success) {
        toast({ title: "Success", description: result.message });
        setIsEditCustomerNameDialogOpen(false);
        const updatedSale = await getSaleByIdAction(sale.id);
        setSale(updatedSale);
        if (updatedSale) {
            setEditingCustomerName(updatedSale.customerName || "");
        }
    } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingCustomerName(false);
  };


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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {session?.role === 'owner' && (
            <Button asChild variant="secondary" className="flex-grow sm:flex-grow-0">
                <Link href={`/sales/${sale.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Sale
                </Link>
            </Button>
          )}
           <div className="flex items-center gap-2">
            <Select value={documentType} onValueChange={(value: DocumentType) => setDocumentType(value)}>
              <SelectTrigger className="w-[150px]" aria-label="Select Document Type">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Invoice">Invoice</SelectItem>
                <SelectItem value="Estimate">Estimate</SelectItem>
                <SelectItem value="Quotation">Quotation</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handlePreviewA4Bill} disabled={isProcessingA4Pdf || isProcessingThermalPdf || isUpdatingStatus} variant="outline" size="sm">
              {(isProcessingA4Pdf && a4PreviewPdfUrl === null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Preview
            </Button>
            <Button onClick={handleDownloadA4Pdf} disabled={isProcessingA4Pdf || isProcessingThermalPdf || isUpdatingStatus} size="sm">
              {(isProcessingA4Pdf && a4PreviewPdfUrl !== null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Download
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button onClick={handleGenerateA4ThermalLayout} disabled={isProcessingA4Thermal || isProcessingA4Pdf || isProcessingThermalPdf || isUpdatingStatus} className="flex-grow sm:flex-grow-0">
            {isProcessingA4Thermal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Print A4 Thermal
          </Button>
          <Button onClick={handleDownloadThermalReceipt} disabled={isProcessingThermalPdf || isProcessingA4Pdf || isUpdatingStatus} className="flex-grow sm:flex-grow-0">
            {(isProcessingThermalPdf && thermalPreviewPdfUrl !== null) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Download Thermal
          </Button>
          {pageUrlForQr && (
            <div className="p-1 bg-white rounded-sm shadow">
              <QRCodeSVG value={pageUrlForQr} size={40} level="M" />
            </div>
          )}
        </div>


      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
            <div>
                <CardTitle>Transaction Information</CardTitle>
                <CardDescription>
                    Details for sale transaction ID: {sale.id}
                </CardDescription>
            </div>
            {sale.totalAmountDue > EPSILON && (
                <Dialog open={isRecordPaymentDialogOpen} onOpenChange={setIsRecordPaymentDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="default" size="sm" onClick={() => {
                            setPaymentAmount(sale.totalAmountDue.toFixed(2));
                            setPaymentMethod('cash');
                            setPaymentNotes("");
                            setIsRecordPaymentDialogOpen(true);
                        }}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Record Payment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                        <DialogTitle>Record Payment for Sale: {sale.id.substring(0,8)}...</DialogTitle>
                        <DialogDescription>
                            Current Amount Due: Rs. {sale.totalAmountDue.toFixed(2)}
                        </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleRecordAdditionalPaymentSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="paymentAmount">Amount Paid (Rs.)</Label>
                                <Input
                                id="paymentAmount"
                                type="number"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                                step="0.01"
                                min="0.01"
                                max={sale.totalAmountDue.toFixed(2)}
                                required
                                disabled={isSubmittingPayment}
                                />
                            </div>
                            <div>
                                <Label htmlFor="paymentMethodDialog">Payment Method</Label>
                                <Select
                                    value={paymentMethod}
                                    onValueChange={(value) => setPaymentMethod(value as Sale['paymentMethod'])}
                                    disabled={isSubmittingPayment}
                                >
                                <SelectTrigger id="paymentMethodDialog">
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="card">Card</SelectItem>
                                    <SelectItem value="online">Online</SelectItem>
                                </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="paymentNotes">Notes (Optional)</Label>
                                <Input
                                id="paymentNotes"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                placeholder="e.g., Paid by customer's friend"
                                disabled={isSubmittingPayment}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsRecordPaymentDialogOpen(false)} disabled={isSubmittingPayment}>
                                Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmittingPayment || !paymentAmount || parseFloat(paymentAmount) <= 0}>
                                {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Submit Payment
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div className="flex items-center gap-1">
                <strong>Customer:</strong> {sale.customerName || 'N/A'}
                {canEditCustomerName && (
                    <Dialog open={isEditCustomerNameDialogOpen} onOpenChange={setIsEditCustomerNameDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => setEditingCustomerName(sale.customerName || "")}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Edit Customer Name</DialogTitle>
                                <DialogDescription>Update the customer's name for this sale.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleEditCustomerNameSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="editingCustomerName">New Customer Name</Label>
                                    <Input
                                        id="editingCustomerName"
                                        value={editingCustomerName}
                                        onChange={(e) => setEditingCustomerName(e.target.value)}
                                        placeholder="Enter customer name"
                                        disabled={isSubmittingCustomerName}
                                        maxLength={100}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setIsEditCustomerNameDialogOpen(false)} disabled={isSubmittingCustomerName}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isSubmittingCustomerName || editingCustomerName.trim() === (sale.customerName || "")}>
                                        {isSubmittingCustomerName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save Name
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
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
            {(sale.recordedByName || sale.recordedByEmail) && (
                 <div className="flex items-center gap-1">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <strong>Recorded by:</strong> {sale.recordedByName || sale.recordedByEmail}
                </div>
            )}
            {sale.notes && <div className="md:col-span-full"><strong>Notes:</strong> {sale.notes}</div>}
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div className="font-medium">Total Bill: <span className="font-semibold">Rs. {sale.totalAmount.toFixed(2)}</span></div>
            <div className="font-medium">Total Paid: <span className="font-semibold text-green-600">Rs. {sale.totalPaidAmount.toFixed(2)}</span></div>
            <div className="font-medium">Amount Due: <span className={cn("font-semibold", sale.totalAmountDue > EPSILON ? "text-destructive" : "text-green-600")}>Rs. {sale.totalAmountDue.toFixed(2)}</span></div>
            {(sale.packagingCharges && sale.packagingCharges > 0) && <div className="text-xs text-muted-foreground">Packaging: Rs. {sale.packagingCharges.toFixed(2)}</div>}
            {(sale.transportCharges && sale.transportCharges > 0) && <div className="text-xs text-muted-foreground">Transport: Rs. {sale.transportCharges.toFixed(2)}</div>}
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SL</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">UOM</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Rate (Rs.)</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sale.items.map((item, index) => (
                  <tr key={`${item.productId || 'adhoc'}-${index}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-center">{index + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-foreground">{item.productNameSnapshot}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">{item.quantitySold.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{item.soldUnit.toUpperCase()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">{item.pricePerUnitSold.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">{item.total.toFixed(2)}</td>
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {sale.paymentHistory.map((payment, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{new Date(payment.date).toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">{payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground capitalize">{payment.paymentMethod?.replace('_', ' ') || 'N/A'}</td>
                      <td className="px-4 py-2 whitespace-normal text-sm text-muted-foreground max-w-xs" title={payment.notes}>{payment.notes || '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{payment.recordedByName || payment.recordedByEmail || 'N/A'}</td>
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
            <DialogTitle>{documentType} Preview (A4)</DialogTitle>
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
