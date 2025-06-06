
"use client";

import { z } from "zod";
import { PRODUCT_UNITS } from "@/lib/constants";
import type { ProductUnit } from "@/lib/constants";


export const saleItemSchema = z.object({
  productId: z.string().optional(),
  // productNameSnapshot is not part of the direct form item schema, it's derived or from itemSearchTexts
  quantitySold: z.coerce.number().min(1, "Quantity must be at least 1."),
  pricePerUnitSold: z.coerce.number().min(0.01, "Price must be positive."),
  soldUnit: z.enum(PRODUCT_UNITS, { errorMap: () => ({ message: 'Invalid sold unit.'}) }),
  // baseUnitSnapshot is not part of the direct form item schema, it's derived or defaulted
});

export const saleFormSchema = z.object({
  saleType: z.enum(['retail', 'wholesale'], { required_error: "Sale type is required."}),
  customerName: z.string().max(100, "Customer name too long").optional().nullable(),
  saleDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid date" }),
  items: z.array(saleItemSchema).min(1, "At least one item is required in the sale."),
  paymentMethod: z.enum(['cash', 'card', 'online'], { required_error: "Payment method is required."}).optional(),
  packagingCharges: z.coerce
    .number({ invalid_type_error: "Packaging charges must be a number." })
    .nonnegative("Packaging charges cannot be negative.")
    .optional(),
  transportCharges: z.coerce
    .number({ invalid_type_error: "Transport charges must be a number." })
    .nonnegative("Transport charges cannot be negative.")
    .optional(),
  amountPaid: z.coerce
    .number({ invalid_type_error: "Amount paid must be a number."})
    .nonnegative("Amount paid cannot be negative."),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
}).superRefine((data, ctx) => {
  let itemsTotal = 0;
  data.items.forEach(item => {
    itemsTotal += (item.quantitySold || 0) * (item.pricePerUnitSold || 0);
  });
  const calculatedGrandTotal = itemsTotal + (data.packagingCharges || 0) + (data.transportCharges || 0);

  if (data.amountPaid > calculatedGrandTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Amount paid cannot be greater than the total bill amount.",
      path: ["amountPaid"],
    });
  }
});

export type SaleItemFormStructure = z.infer<typeof saleItemSchema>; // Represents one item in the form's items array
export type SaleFormData = z.infer<typeof saleFormSchema>;

// This type will be used for the data sent to the server action
export type RecordSaleActionPayload = Omit<SaleFormData, 'customerName' | 'notes' | 'items' | 'packagingCharges' | 'transportCharges' | 'amountPaid'> & {
  customerName?: string;
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
  totalAmount: number;
  amountPaid: number;
};
