import type { ProductCategory, ProductUnit } from './constants';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  purchasePrice: number; // Price bought from vendor per unit
  wholesalePrice: number; // Price sold to other shops per unit
  retailPrice: number; // Price sold to end-user per unit
  unit: ProductUnit;
  quantityInStock: number; // Current stock level
  sku?: string; // Stock Keeping Unit, optional
  barcode?: string; // Optional
  reorderThreshold?: number; // Optional, for alerts
  vendor?: string; // Optional, main vendor
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export interface Purchase {
  id:string;
  productId: string;
  productNameSnapshot: string; // Snapshot of product name at time of purchase
  quantityPurchased: number;
  purchasePricePerUnit: number;
  totalCost: number;
  purchaseDate: string; // ISO Date string
  vendor?: string; 
  notes?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[]; // Support for multiple items in a single sale
  totalAmount: number;
  saleType: 'wholesale' | 'retail';
  saleDate: string; // ISO Date string
  customerName?: string; 
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
}

export interface SaleItem {
  productId: string;
  productNameSnapshot: string; // Snapshot of product name at time of sale
  quantitySold: number;
  pricePerUnitSold: number; // Actual price it was sold at
  unitSnapshot: ProductUnit; // Snapshot of product unit
  total: number;
}

// For forms - typically omit id, createdAt, updatedAt, and snapshots
export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantityInStock'> & { initialStock: number };
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate'> & { purchaseDate?: Date };
export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'unitSnapshot' | 'total'>;
export type SaleFormData = {
  items: SaleItemFormData[];
  saleType: 'wholesale' | 'retail';
  saleDate?: Date;
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
};

// Summary types for dashboard
export interface StockSummary {
  totalProducts: number;
  totalStockValue: number; // Based on purchase price
  lowStockItems: number;
}

export interface SalesTrend {
  date: string;
  totalSales: number;
}

export interface PurchaseTrend {
  date: string;
  totalPurchases: number;
}
