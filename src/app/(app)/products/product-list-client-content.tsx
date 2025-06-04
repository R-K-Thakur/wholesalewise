
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/lib/types";
import { deleteProductAction, addStockToProductAction } from "./actions";
import { ChevronLeft, ChevronRight, PlusCircle, Edit, Trash2, PackagePlus, Loader2, Search } from "lucide-react";
import { ITEMS_PER_PAGE_STORAGE_KEY } from "@/lib/constants";

const DEFAULT_ITEMS_PER_PAGE = 10;

interface ProductListClientContentProps {
  products: Product[];
}

export function ProductListClientContent({ products: initialProducts }: ProductListClientContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filteredProducts, setFilteredProducts] = React.useState<Product[]>(initialProducts);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [productToDelete, setProductToDelete] = React.useState<Product | null>(null);

  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = React.useState(false);
  const [productForStockAdd, setProductForStockAdd] = React.useState<Product | null>(null);
  const [quantityToAdd, setQuantityToAdd] = React.useState<number | string>("");
  const [newPurchasePrice, setNewPurchasePrice] = React.useState<number | string>("");
  const [isSubmittingStock, setIsSubmittingStock] = React.useState(false);

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
    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
    const newFilteredProducts = lowercasedSearchTerm
      ? initialProducts.filter(product => 
          product.name.toLowerCase().includes(lowercasedSearchTerm) ||
          product.category.toLowerCase().includes(lowercasedSearchTerm) ||
          (product.sku && product.sku.toLowerCase().includes(lowercasedSearchTerm))
        )
      : initialProducts;
    setFilteredProducts(newFilteredProducts);
    setCurrentPage(1); // Reset to first page on new search or data change
  }, [initialProducts, searchTerm]);


  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      const result = await deleteProductAction(productToDelete.id);
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message,
        });
        router.refresh(); 
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to delete product.",
          variant: "destructive",
        });
      }
    }
    setProductToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleAddStockClick = (product: Product) => {
    setProductForStockAdd(product);
    setQuantityToAdd("");
    setNewPurchasePrice(product.purchasePrice !== undefined ? product.purchasePrice.toString() : "");
    setIsAddStockDialogOpen(true);
  };

  const handleConfirmAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForStockAdd || quantityToAdd === "" || Number(quantityToAdd) <= 0) {
      toast({ title: "Input Error", description: "Please enter a valid quantity to add.", variant: "destructive" });
      return;
    }
    setIsSubmittingStock(true);
    const qty = Number(quantityToAdd);
    const price = newPurchasePrice === "" ? undefined : Number(newPurchasePrice);

    if (price !== undefined && price < 0) {
        toast({ title: "Input Error", description: "Purchase price cannot be negative.", variant: "destructive" });
        setIsSubmittingStock(false);
        return;
    }

    const result = await addStockToProductAction(productForStockAdd.id, qty, price);
    if (result.success) {
      toast({ title: "Success", description: result.message });
      setIsAddStockDialogOpen(false);
      router.refresh(); 
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsSubmittingStock(false);
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
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
    // Simplified loading state to prevent layout shifts before client-side hydration
    return <div className="py-10 text-center text-muted-foreground">Loading products list...</div>;
  }

  return (
    <>
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search products by name, category, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full md:w-1/2 lg:w-1/3"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Purch. Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Retail Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Wholesale Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Units</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {paginatedProducts.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-foreground">{product.name}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.category}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.quantityInStock} {product.baseUnit}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">\u20B9{(product.purchasePrice || 0).toFixed(2)} <span className="text-xs">/{product.purchaseUnit}</span></td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">\u20B9{(product.retailPricePerBaseUnit || 0).toFixed(2)} <span className="text-xs">/{product.baseUnit}</span></td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">\u20B9{(product.wholesalePricePerBaseUnit || 0).toFixed(2)} <span className="text-xs">/{product.baseUnit}</span></td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {product.baseUnit} / {product.purchaseUnit}
                    {product.baseUnit !== product.purchaseUnit && ` (${product.purchaseUnitConversionFactor}:1)`}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-center space-x-1">
                  <Button variant="outline" size="sm" onClick={() => handleAddStockClick(product)} title="Add Stock">
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" asChild title="Edit Product">
                    <Link href={`/products/${product.id}/edit`}><Edit className="h-4 w-4" /></Link>
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(product)} title="Delete Product">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-muted-foreground">
                    {searchTerm ? `No products found matching "${searchTerm}".` : "No products found."}
                </td>
              </tr>
            )}
             {filteredProducts.length > 0 && paginatedProducts.length === 0 && currentPage > 1 && (
              <tr>
                <td colSpan={8} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No products on this page. Try adjusting your search or page number.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({filteredProducts.length} total items)
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

      {productToDelete && (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the product
                "{productToDelete.name}".
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {productForStockAdd && (
        <Dialog open={isAddStockDialogOpen} onOpenChange={setIsAddStockDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleConfirmAddStock}>
              <DialogHeader>
                <DialogTitle>Add Stock for: {productForStockAdd.name}</DialogTitle>
                <DialogDescription>
                  Current Stock: {productForStockAdd.quantityInStock} {productForStockAdd.baseUnit}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="quantityToAdd" className="text-right col-span-1">
                    Quantity (in {productForStockAdd.purchaseUnit})
                  </Label>
                  <Input
                    id="quantityToAdd"
                    type="number"
                    value={quantityToAdd}
                    onChange={(e) => setQuantityToAdd(e.target.value)}
                    className="col-span-3"
                    min="1"
                    required
                    disabled={isSubmittingStock}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="newPurchasePrice" className="text-right col-span-1">
                    Price / {productForStockAdd.purchaseUnit} (\u20B9)
                  </Label>
                  <Input
                    id="newPurchasePrice"
                    type="number"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    className="col-span-3"
                    placeholder={`Optional: Current is \u20B9${(productForStockAdd.purchasePrice || 0).toFixed(2)}`}
                    step="0.01"
                    min="0"
                    disabled={isSubmittingStock}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddStockDialogOpen(false)} disabled={isSubmittingStock}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingStock || quantityToAdd === "" || Number(quantityToAdd) <=0}>
                  {isSubmittingStock && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Stock
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
