
"use client";

import { z } from "zod";
import { PRODUCT_UNITS } from "@/lib/constants";
import type { ProductUnit } from "@/lib/constants";


export const saleItemSchema = z.object({
  productId: z.string().optional(),
  productNameSnapshot: z.string().optional(), // For display on edit form
  quantitySold: z.coerce.number().min(0.01, "Quantity must be positive."),
  pricePerUnitSold: z.coerce.number().min(0.01, "Price must be positive."), // User can edit this
  soldUnit: z.enum(PRODUCT_UNITS, { errorMap: () => ({ message: 'Invalid sold unit.'}) }),
});

export const saleFormSchema = z.object({
  saleType: z.enum(['wholesale', 'retail']).default('wholesale'),
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(100, "Customer name too long").optional().nullable(),
  customerPhone: z.string().max(20, "Phone number too long").optional().nullable(),
  saleDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid date" }),
  items: z.array(saleItemSchema),
  paymentMethod: z.enum(['cash', 'card', 'online'], { required_error: "Payment method is required."}).optional(),
  packagingCharges: z.coerce
    .number({ invalid_type_error: "Packaging charges must be a number." })
    .nonnegative("Packaging charges cannot be negative.")
    .optional(),
  transportCharges: z.coerce
    .number({ invalid_type_error: "Transport charges must be a number." })
    .nonnegative("Transport charges cannot be negative.")
    .optional(),
  discountType: z.enum(['percentage', 'fixed']).optional().default('fixed'),
  discountValue: z.coerce
    .number({ invalid_type_error: "Discount must be a number." })
    .nonnegative("Discount cannot be negative.")
    .optional()
    .default(0),
  discountAmount: z.coerce
    .number({ invalid_type_error: "Discount amount must be a number." })
    .nonnegative("Discount amount cannot be negative.")
    .optional()
    .default(0),
  amountPaid: z.coerce
    .number({ invalid_type_error: "Amount paid must be a number."})
    .nonnegative("Amount paid cannot be negative."),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.items.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one item is required in the sale.",
      path: ["items"],
    });
  }

  let itemsTotal = 0;
  data.items.forEach(item => {
    itemsTotal += (item.quantitySold || 0) * (item.pricePerUnitSold || 0);
  });

  let calculatedDiscount = 0;
  if (data.saleType !== 'wholesale' && data.discountValue && data.discountValue > 0) {
    if (data.discountType === 'percentage') {
      calculatedDiscount = parseFloat(((itemsTotal * data.discountValue) / 100).toFixed(2));
    } else {
      calculatedDiscount = parseFloat(data.discountValue.toFixed(2));
    }
  }
  calculatedDiscount = Math.min(itemsTotal, calculatedDiscount);

  const calculatedGrandTotal = parseFloat(
    Math.max(0, itemsTotal - calculatedDiscount + (data.packagingCharges || 0) + (data.transportCharges || 0)).toFixed(2)
  );

  if (data.amountPaid > calculatedGrandTotal + 0.001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Amount paid cannot be greater than the total bill amount.",
      path: ["amountPaid"],
    });
  }

  // If there is any amount due, customer name is required so their due can be tracked in their profile
  const dueAmount = calculatedGrandTotal - data.amountPaid;
  if (dueAmount > 0.001 && (!data.customerName || data.customerName.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Customer name is required when there is a due amount to record in their profile.",
      path: ["customerName"],
    });
  }
});

export type SaleItemFormStructure = z.infer<typeof saleItemSchema>;
export type SaleFormData = z.infer<typeof saleFormSchema>;

export type RecordSaleActionPayload = Omit<SaleFormData, 'customerId' | 'customerName' | 'customerPhone' | 'notes' | 'items' | 'packagingCharges' | 'transportCharges' | 'discountType' | 'discountValue' | 'discountAmount' | 'amountPaid' | 'saleType'> & {
  saleType: 'wholesale' | 'retail';
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: Array<{
    productId?: string;
    productNameSnapshot: string;
    quantitySold: number;
    pricePerUnitSold: number;
    soldUnit: ProductUnit;
    baseUnitSnapshot: ProductUnit;
    total: number;
  }>;
  packagingCharges?: number;
  transportCharges?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  totalAmount: number;
  amountPaid: number;
};
