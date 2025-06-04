
"use client";

import { z } from "zod";
import { PRODUCT_UNITS } from "@/lib/constants"; // Assuming ProductUnit is defined
import type { ProductUnit } from "@/lib/constants";


export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  productNameSnapshot: z.string().optional(), // Will be populated before sending to action
  quantitySold: z.coerce.number().min(1, "Quantity must be at least 1."),
  pricePerUnitSold: z.coerce.number().min(0.01, "Price must be positive."),
  soldUnit: z.enum(PRODUCT_UNITS, { errorMap: () => ({ message: 'Invalid sold unit.'}) }),
  baseUnitSnapshot: z.enum(PRODUCT_UNITS, { errorMap: () => ({ message: 'Invalid base unit snapshot.'}) }),
  total: z.coerce.number().optional(), // Calculated field
});

export const saleFormSchema = z.object({
  saleType: z.enum(['retail', 'wholesale'], { required_error: "Sale type is required."}),
  customerName: z.string().max(100, "Customer name too long").optional().nullable(),
  saleDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid date" }),
  items: z.array(saleItemSchema).min(1, "At least one item is required in the sale."),
  paymentMethod: z.enum(['cash', 'card', 'online'], { required_error: "Payment method is required."}).optional(),
  notes: z.string().max(500, "Notes too long").optional().nullable(),
  // totalAmount will be calculated before sending to action
});

export type SaleItemFormData = z.infer<typeof saleItemSchema>;
export type SaleFormData = z.infer<typeof saleFormSchema>;

// This type will be used for the data sent to the server action
export type RecordSaleActionPayload = Omit<SaleFormData, 'customerName' | 'notes'> & {
  customerName?: string; // Making them truly optional for action
  notes?: string;
  items: Array<SaleItemFormData & { productNameSnapshot: string; total: number }>; // Ensure productNameSnapshot and total are present
  totalAmount: number;
};
