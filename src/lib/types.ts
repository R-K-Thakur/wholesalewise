
import type { ProductCategory, ProductUnit } from './constants';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;

  baseUnit: ProductUnit;
  purchaseUnit: ProductUnit;
  purchaseUnitConversionFactor: number;

  purchasePrice: number; // Can be 0 if set by staff initially

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
  purchaseBillId?: string;
}

export interface PurchaseBillItem {
  productId: string;
  productNameSnapshot: string;
  quantityPurchased: number;
  purchasePricePerUnit: number;
  purchaseUnit: ProductUnit;
  itemTotal: number;
  conversionFactorSnapshot?: number;
}

export interface PurchaseBill {
  id: string;
  invoiceNumber?: string;
  supplierName: string;
  supplierPhone?: string;
  purchaseDate: string;
  items: PurchaseBillItem[];
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  paymentMethod: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'credit';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface PurchaseBillFormData {
  supplierName: string;
  supplierPhone?: string;
  invoiceNumber?: string;
  purchaseDate: string;
  items: {
    productId: string;
    quantityPurchased: number;
    purchasePricePerUnit: number;
    purchaseUnit: ProductUnit;
  }[];
  paymentMethod: 'cash' | 'bank_transfer' | 'upi' | 'cheque' | 'credit';
  amountPaid: number;
  notes?: string;
}

export interface PaymentTransaction {
  date: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'online' | 'manual_adjustment';
  notes?: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  customerType?: 'wholesale' | 'retail';
  totalDue: number; // Positive means amount due to be paid by customer
  totalPurchases: number; // Sum of all bills
  totalPaid: number; // Sum of all payments received
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string;
  createdByName?: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  type: 'sale' | 'payment' | 'adjustment';
  saleId?: string;
  amount: number; // Total amount of sale, or payment amount
  amountPaid?: number; // For sales: amount paid at billing
  dueAdded: number; // Amount added to due (for sale: total - paid; for payment: -amount)
  balanceAfter: number; // Running totalDue balance after this transaction
  paymentMethod?: 'cash' | 'card' | 'online' | 'manual_adjustment';
  date: string;
  notes?: string;
  createdAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface CustomerFormData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  customerType?: 'wholesale' | 'retail';
}

export interface RecordCustomerPaymentPayload {
  customerId: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'online' | 'manual_adjustment';
  date?: string;
  notes?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  packagingCharges?: number;
  transportCharges?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  totalAmount: number;
  totalPaidAmount: number;
  totalAmountDue: number;
  paymentStatus: 'paid' | 'partially_paid' | 'unpaid';
  paymentHistory: PaymentTransaction[];
  saleType: 'wholesale' | 'retail';
  saleDate: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerNameInitiallyEmpty?: boolean; // New field
  staffMadeInitialEdit?: boolean;      // New field
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface SaleItem {
  productId?: string;
  productNameSnapshot: string;
  quantitySold: number;
  pricePerUnitSold: number;
  soldUnit: ProductUnit;
  baseUnitSnapshot: ProductUnit;
  total: number;
}

export type ProductFormData = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'quantityInStock' | 'createdByEmail' | 'createdByName' | 'lastStockUpdateByEmail' | 'lastStockUpdateByName'> & { initialStockInPurchaseUnits: number };
export type PurchaseFormData = Omit<Purchase, 'id' | 'productNameSnapshot' | 'totalCost' | 'purchaseDate' | 'purchaseUnitSnapshot' | 'createdAt' | 'updatedAt' | 'recordedByEmail' | 'recordedByName'> & { purchaseDate?: Date };


export type SaleItemFormData = Omit<SaleItem, 'productNameSnapshot' | 'total' | 'pricePerUnitSold' | 'baseUnitSnapshot'> & { pricePerUnitSold?: number };
export type SaleFormData = {
  items: SaleItemFormData[];
  saleType: 'wholesale' | 'retail';
  saleDate?: Date;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: 'cash' | 'card' | 'online';
  notes?: string;
  packagingCharges?: number;
  transportCharges?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
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

// ==================== Inventory Adjustments (Step 3) ====================
export type InventoryAdjustmentType =
  | 'damage'
  | 'expiry'
  | 'audit_discrepancy'
  | 'theft_or_loss'
  | 'internal_use'
  | 'other';

export interface InventoryAdjustment {
  id: string;
  productId: string;
  productNameSnapshot: string;
  categorySnapshot?: string;
  type: InventoryAdjustmentType;
  quantityAdjusted: number; // positive = stock increased, negative = stock decreased
  unit: ProductUnit;
  unitCostSnapshot: number; // purchase price snapshot per unit
  totalValueImpact: number; // quantityAdjusted * unitCostSnapshot
  reason: string;
  notes?: string;
  date: string;
  createdAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface RecordInventoryAdjustmentPayload {
  productId: string;
  type: InventoryAdjustmentType;
  quantityAdjusted: number;
  reason: string;
  notes?: string;
  date?: string;
}

// ==================== Sales Returns & Credit Notes (Step 3) ====================
export type ReturnItemCondition = 'resellable' | 'damaged';
export type ReturnRefundMethod = 'cash' | 'deduct_customer_due' | 'store_credit';

export interface SaleReturnItem {
  productId?: string;
  productNameSnapshot: string;
  quantityReturned: number;
  unit: ProductUnit;
  pricePerUnit: number;
  totalRefund: number;
  condition: ReturnItemCondition;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleReturnItem[];
  totalReturnAmount: number;
  refundMethod: ReturnRefundMethod;
  returnReason: string;
  notes?: string;
  returnDate: string;
  createdAt: string;
  recordedByEmail?: string;
  recordedByName?: string;
}

export interface RecordSaleReturnPayload {
  saleId: string;
  items: {
    productId?: string;
    productNameSnapshot: string;
    quantityReturned: number;
    unit: ProductUnit;
    pricePerUnit: number;
    condition: ReturnItemCondition;
  }[];
  refundMethod: ReturnRefundMethod;
  returnReason: string;
  notes?: string;
  returnDate?: string;
}

// ==================== Staff Management & Credentials ====================
export interface StaffMember {
  id: string; // document id (typically normalized staffId)
  staffId: string; // unique ID or username (e.g., EMP001, STF01, rahul)
  name: string; // staff full name
  email: string; // staff email
  password: string; // credential visible to admin for recovery
  role: 'staff';
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMemberInput {
  staffId: string;
  name: string;
  email: string;
  password: string;
  isActive?: boolean;
  notes?: string;
}

