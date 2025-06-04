
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
  id:string;
  productId: string;
  productNameSnapshot: string; // Snapshot of product name at time of purchase
  quantityPurchased: number; // In purchaseUnits of the product
  purchasePricePerUnitSnapshot: number; // Price per purchaseUnit
  totalCost: number;
  purchaseDate: string; // ISO Date string
  vendor?: string;
  notes?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  saleType: 'wholesale' | 'retail';
  saleDate: string; // ISO Date string
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  createdAt: string; // ISO Date string
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
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate'> & { purchaseDate?: Date };

export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'baseUnitSnapshot' | 'total' | 'pricePerUnitSold'> & { pricePerUnitSold?: number }; // pricePerUnitSold is optional as it will be set
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
