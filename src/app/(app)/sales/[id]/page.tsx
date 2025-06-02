
"use client"; // Required for using useParams

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import type { ProductUnit } from '@/lib/constants'; // Assuming ProductUnit is defined

// Mock data - replace with actual data fetching logic
const mockSalesData: Record<string, SaleDetails> = {
  "1": {
    id: "1",
    customerName: "Local Shop A",
    saleDate: "2024-07-20",
    saleType: "wholesale",
    paymentMethod: "online",
    notes: "Urgent delivery requested.",
    items: [
      { productId: "prod1", productNameSnapshot: "Lavender Lipstick", quantitySold: 10, pricePerUnitSold: 500, total: 5000, unitSnapshot: "piece" },
      { productId: "prod2", productNameSnapshot: "Teal Hair Oil", quantitySold: 5, pricePerUnitSold: 1100, total: 5500, unitSnapshot: "piece" },
    ],
    totalAmount: 10500.00,
  },
  "2": {
    id: "2",
    customerName: "Retail Customer",
    saleDate: "2024-07-19",
    saleType: "retail",
    paymentMethod: "cash",
    notes: "",
    items: [
      { productId: "prod3", productNameSnapshot: "Silver Earrings", quantitySold: 1, pricePerUnitSold: 999, total: 999, unitSnapshot: "set" },
    ],
    totalAmount: 999.00,
  },
};

interface SaleItemDetails {
  productId: string;
  productNameSnapshot: string;
  quantitySold: number;
  pricePerUnitSold: number;
  total: number;
  unitSnapshot: ProductUnit;
}

interface SaleDetails {
  id: string;
  customerName?: string;
  saleDate: string;
  saleType: 'wholesale' | 'retail';
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  items: SaleItemDetails[];
  totalAmount: number;
}


export default function SaleDetailPage() {
  const params = useParams();
  const saleId = params.id as string;
  
  // In a real app, you would fetch sale details based on saleId
  const sale = mockSalesData[saleId]; // Using mock data

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
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/sales">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Sales</span>
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Sale Details - ID: {sale.id}
        </h1>
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Price/Unit</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {sale.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-foreground">{item.productNameSnapshot}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{item.quantitySold}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground">{item.unitSnapshot}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">₹{item.pricePerUnitSold.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-muted-foreground text-right">₹{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right">
            <p className="text-lg font-semibold">Grand Total: ₹{sale.totalAmount.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
