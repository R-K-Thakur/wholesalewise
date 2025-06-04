
import type { ProductCategory, ProductUnit } from './constants';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  baseUnit: ProductUnit; // Smallest sellable unit (e.g., "piece")
  purchaseUnit: ProductUnit; // Unit product is bought in (e.g., "dozen")
  // Conversion factor: how many baseUnits are in one purchaseUnit.
  // E.g., if purchaseUnit is "dozen" and baseUnit is "piece", factor is 12.
  // If purchaseUnit is "piece" and baseUnit is "piece", factor is 1.
  purchaseUnitConversionFactor: number;

  purchasePrice: number; // Price per purchaseUnit

  retailPricePerBaseUnit: number;
  wholesalePricePerBaseUnit: number;

  quantityInStock: number; // Current stock level IN BASE UNITS

  sku?: string;
  barcode?: string;
  reorderThreshold?: number; // In BASE UNITS
  vendor?: string;
  createdAt: string; // ISO Date string
  updatedAt: string; // ISO Date string
}

export interface Purchase {
  id: string;
  productId: string;
  productNameSnapshot: string; // Snapshot of product name at time of purchase
  quantityPurchased: number; // In purchaseUnits of the product
  purchaseUnitSnapshot: ProductUnit; // Snapshot of the product's purchaseUnit
  purchasePricePerUnitSnapshot: number; // Price per purchaseUnit at time of purchase
  totalCost: number;
  purchaseDate: string; // ISO Date string - effectively the event date for the purchase
  // vendor?: string; // Kept minimal for now based on current "Add Stock"
  // notes?: string;  // Kept minimal
  createdAt: string; // ISO Date string - when the record was created in DB
  updatedAt: string; // ISO Date string
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  saleType: 'wholesale' | 'retail';
  saleDate: string; // ISO Date string - the date the sale occurred
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  createdAt: string; // ISO Date string - when the record was created in DB
  updatedAt: string; // ISO Date string
}

export interface SaleItem {
  productId: string;
  productNameSnapshot: string;
  quantitySold: number; // Quantity in soldUnit
  pricePerUnitSold: number; // Price for the soldUnit
  soldUnit: ProductUnit; // Unit the item was sold in (baseUnit or purchaseUnit)
  baseUnitSnapshot: ProductUnit; // Base unit of the product at time of sale
  total: number;
}

// For forms - typically omit id, createdAt, updatedAt, and snapshots
export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantityInStock'> & { initialStockInPurchaseUnits: number }; // initialStock is in purchase units for new product form
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate' | 'purchaseUnitSnapshot' | 'createdAt' | 'updatedAt'> & { purchaseDate?: Date };


export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'total' | 'pricePerUnitSold'> & { pricePerUnitSold?: number };
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
  date: string; // Formatted date string for chart (e.g., "MMM d")
  totalPurchases: number; // Total cost of purchases on this date
  fullDate?: string; // Original full date for sorting if needed (e.g., "yyyy-MM-dd")
}

// For Recent Activity Widget
export interface ActivityItem {
  id: string; // Unique ID, can be sale.id, purchase.id
  type: 'sale' | 'purchase'; // 'new_product' can be inferred from purchase context
  date: string; // ISO Date string for sorting (typically createdAt of the event record)
  description: string;
  amount?: number; // For sales or purchase totalCost
  link?: string; // e.g., to /sales/[id] or /products/[id]/edit
}
