
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Import useRouter
import { Button } from "@/components/ui/button";
import type { Sale } from "@/lib/types";
import { ChevronLeft, ChevronRight, Trash2, Loader2, AlertTriangle } from "lucide-react"; // Added Trash2, Loader2, AlertTriangle
import { ITEMS_PER_PAGE_STORAGE_KEY } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getSession, type SessionData } from "@/app/login/actions"; // Import getSession
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { useToast } from "@/hooks/use-toast"; // Import useToast
import { deleteSaleAction } from "./actions"; // Import deleteSaleAction

const DEFAULT_ITEMS_PER_PAGE = 10;

interface SalesListClientContentProps {
  sales: Sale[];
  initialRole?: 'owner' | 'staff';
}

export function SalesListClientContent({ sales: initialSales, initialRole }: SalesListClientContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [sales, setSales] = React.useState<Sale[]>(initialSales);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(DEFAULT_ITEMS_PER_PAGE);
  const [isMounted, setIsMounted] = React.useState(false);
  const [session, setSession] = React.useState<SessionData | null>(initialRole ? ({ role: initialRole } as any) : null);

  // State for delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [saleToDelete, setSaleToDelete] = React.useState<Sale | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);


  React.useEffect(() => {
    setIsMounted(true);
    if (!initialRole) {
      async function fetchSessionData() {
        const currentSession = await getSession();
        setSession(currentSession);
      }
      fetchSessionData();
    }
    const storedItemsPerPage = localStorage.getItem(ITEMS_PER_PAGE_STORAGE_KEY);
    if (storedItemsPerPage) {
      setItemsPerPage(parseInt(storedItemsPerPage, 10) || DEFAULT_ITEMS_PER_PAGE);
    }
  }, [initialRole]);

  React.useEffect(() => {
    setSales(initialSales);
    setCurrentPage(1);
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

  const getStatusBadgeVariant = (status: Sale['paymentStatus']): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'paid':
        return 'default';
      case 'partially_paid':
        return 'secondary';
      case 'unpaid':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleDeleteClick = (sale: Sale) => {
    setSaleToDelete(sale);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!saleToDelete) return;
    setIsDeleting(true);
    const result = await deleteSaleAction(saleToDelete.id);
    if (result.success) {
      toast({
        title: "Success!",
        description: result.message,
      });
      router.refresh(); // Refresh data on the page
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to delete sale.",
        variant: "destructive",
      });
    }
    setIsDeleting(false);
    setIsDeleteDialogOpen(false);
    setSaleToDelete(null);
  };


  if (!isMounted) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total (Rs.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid (Rs.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Due (Rs.)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            <tr>
              <td colSpan={7} className="px-6 py-4 text-center text-sm text-muted-foreground">Loading sales records...</td>
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
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Customer Name</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total (Rs.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid (Rs.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Due (Rs.)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {paginatedSales.map((sale) => (
              <tr key={sale.id}>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(sale.saleDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                  {sale.customerId ? (
                    <Link href={`/customers/${sale.customerId}`} className="text-primary hover:underline font-medium">
                      {sale.customerName || "N/A"}
                    </Link>
                  ) : (
                    sale.customerName || "N/A"
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{sale.totalAmount.toFixed(2)}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">{sale.totalPaidAmount.toFixed(2)}</td>
                <td className={cn(
                  "px-4 py-4 whitespace-nowrap text-sm text-right font-medium",
                  sale.totalAmountDue > 0 ? "text-destructive" : "text-green-600"
                )}>
                  {sale.totalAmountDue.toFixed(2)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-center">
                  <Badge variant={getStatusBadgeVariant(sale.paymentStatus)} className="capitalize">
                    {sale.paymentStatus.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center space-x-1">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/sales/${sale.id}`}>View Details</Link>
                  </Button>
                  {session?.role === 'owner' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(sale)}
                      disabled={isDeleting}
                      title="Delete Sale"
                    >
                      {isDeleting && saleToDelete?.id === sale.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-muted-foreground">No sales recorded yet.</td>
              </tr>
            )}
            {sales.length > 0 && paginatedSales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-sm text-muted-foreground">
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

      {saleToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <AlertDialogTitle>Delete Sale Record?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                Are you sure you want to delete the sale record for "{saleToDelete.customerName || `ID: ${saleToDelete.id.substring(0, 8)}...`}" on {new Date(saleToDelete.saleDate).toLocaleDateString()}?
                This action cannot be undone and will restore the stock for the items sold in this transaction.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setSaleToDelete(null); }} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Delete Sale
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

