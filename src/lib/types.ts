
import type { ProductCategory, ProductUnit } from './constants';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  baseUnit: ProductUnit;
  purchaseUnit: ProductUnit;
  purchaseUnitConversionFactor: number;

  purchasePrice: number;

  retailPricePerBaseUnit: number;
  wholesalePricePerBaseUnit: number;

  quantityInStock: number;

  sku?: string;
  barcode?: string;
  reorderThreshold?: number;
  vendor?: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string;
  lastStockUpdateByEmail?: string;
}

export interface Purchase {
  id: string;
  productId: string;
  productNameSnapshot: string;
  quantityPurchased: number;
  purchaseUnitSnapshot: ProductUnit;
  purchasePricePerUnitSnapshot: number;
  totalCost: number;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
  recordedByEmail?: string;
}

export interface PaymentTransaction {
  date: string;
  amount: number;
  paymentMethod?: Sale['paymentMethod'] | 'manual_adjustment'; // Allow 'manual_adjustment'
  notes?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number; // The grand total value of the sale
  totalPaidAmount: number; // The total amount paid for this sale so far
  totalAmountDue: number; // The remaining balance (totalAmount - totalPaidAmount)
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  paymentHistory: PaymentTransaction[];
  saleType: 'wholesale' | 'retail';
  saleDate: string;
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online'; // Represents the method of the *initial* payment transaction
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productNameSnapshot: string;
  quantitySold: number;
  pricePerUnitSold: number;
  soldUnit: ProductUnit;
  baseUnitSnapshot: ProductUnit;
  total: number;
}

export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantityInStock' | 'createdByEmail' | 'lastStockUpdateByEmail'> & { initialStockInPurchaseUnits: number };
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate' | 'purchaseUnitSnapshot' | 'createdAt' | 'updatedAt' | 'recordedByEmail'> & { purchaseDate?: Date };


export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'total' | 'pricePerUnitSold'> & { pricePerUnitSold?: number };
export type SaleFormData = {
  items: SaleItemFormData[];
  saleType: 'wholesale' | 'retail';
  saleDate?: Date; // Will be string in form
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  amountPaid: number; // Amount paid in this transaction
};

export interface ActivityItem {
  id: string;
  type: 'sale' | 'purchase';
  date: string;
  description: string;
  amount?: number;
  link?: string;
  recordedByEmail?: string; // Added to show who recorded a purchase/stock update
}

export interface SalesTrend {
  date: string;
  totalSales: number;
}

export interface PurchaseTrend {
  date: string;
  totalPurchases: number;
  fullDate?: string;
}

