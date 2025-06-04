
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Sale } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ITEMS_PER_PAGE_STORAGE_KEY } from "@/lib/constants";

const DEFAULT_ITEMS_PER_PAGE = 10;

interface SalesListClientContentProps {
  sales: Sale[];
}

export function SalesListClientContent({ sales: initialSales }: SalesListClientContentProps) {
  const [sales, setSales] = React.useState<Sale[]>(initialSales);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(DEFAULT_ITEMS_PER_PAGE);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    const storedItemsPerPage = localStorage.getItem(ITEMS_PER_PAGE_STORAGE_KEY);
    if (storedItemsPerPage) {
      setItemsPerPage(parseInt(storedItemsPerPage, 10) || DEFAULT_ITEMS_PER_PAGE);
    }
  }, []);
  
  React.useEffect(() => {
    setSales(initialSales);
    setCurrentPage(1); // Reset to first page if sales data changes
  }, [initialSales]);


  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const paginatedSales = sales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  if (!isMounted) {
    return (
       <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Items Sold</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Amount (Rs.)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">Loading sales records...</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Items Sold</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Amount (Rs.)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {paginatedSales.map((sale) => (
              <tr key={sale.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  {sale.customerName || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">{sale.saleType}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-center">{sale.items.reduce((acc, item) => acc + item.quantitySold, 0)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{sale.totalAmount.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(sale.saleDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sales/${sale.id}`}>View Details</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">No sales recorded yet.</td>
              </tr>
            )}
            {sales.length > 0 && paginatedSales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No sales records on this page. Try adjusting filters or page number.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sales.length > itemsPerPage && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

