
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
  createdByName?: string; 
  lastStockUpdateByEmail?: string;
  lastStockUpdateByName?: string; 
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
  recordedByName?: string;
}

export interface PaymentTransaction {
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'online' | 'manual_adjustment';
  notes?: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  totalPaidAmount: number;
  totalAmountDue: number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  paymentHistory: PaymentTransaction[];
  saleType: 'wholesale' | 'retail';
  saleDate: string;
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface SaleItem {
  productId?: string; // Made optional
  productNameSnapshot: string;
  quantitySold: number;
  pricePerUnitSold: number;
  soldUnit: ProductUnit;
  baseUnitSnapshot: ProductUnit;
  total: number;
}

export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantityInStock' | 'createdByEmail' | 'createdByName' | 'lastStockUpdateByEmail' | 'lastStockUpdateByName'> & { initialStockInPurchaseUnits: number };
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate' | 'purchaseUnitSnapshot' | 'createdAt' | 'updatedAt' | 'recordedByEmail' | 'recordedByName'> & { purchaseDate?: Date };


export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'total' | 'pricePerUnitSold' | 'baseUnitSnapshot'> & { pricePerUnitSold?: number }; // baseUnitSnapshot removed from direct form item data
export type SaleFormData = {
  items: SaleItemFormData[];
  saleType: 'wholesale' | 'retail';
  saleDate?: Date;
  customerName?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  amountPaid: number;
};

export interface ActivityItem {
  id: string;
  type: 'sale' | 'purchase';
  date: string;
  description: string;
  amount?: number;
  link?: string;
  recordedByEmail?: string;
  recordedByName?: string;
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

export interface RecordAdditionalPaymentPayload {
  saleId: string;
  amountPaidNow: number;
  paymentMethod: 'cash' | 'card' | 'online'; 
  paymentNotes?: string;
}
    
    

    

    

    

