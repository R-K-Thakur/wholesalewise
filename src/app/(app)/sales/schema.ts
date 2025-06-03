
"use client";

import { z } from "zod";
import type { ProductUnit } from "@/lib/constants"; // Assuming ProductUnit is defined

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  productNameSnapshot: z.string().optional(),
  quantitySold: z.coerce.number().min(1, "Quantity must be at least 1."),
  pricePerUnitSold: z.coerce.number().min(0.01, "Price must be positive."),
  unitSnapshot: z.custom<ProductUnit>().optional(),
  total: z.coerce.number().optional(), // Calculated field
});

export const saleFormSchema = z.object({
  saleType: z.enum(['retail', 'wholesale'], { required_error: "Sale type is required."}),
  customerName: z.string().optional(),
  saleDate: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Invalid date" }),
  items: z.array(saleItemSchema).min(1, "At least one item is required in the sale."),
  paymentMethod: z.enum(['cash', 'card', 'online'], { required_error: "Payment method is required."}).optional(),
  // totalAmount will be calculated before sending to action
});

export type SaleItemFormData = z.infer<typeof saleItemSchema>;
export type SaleFormData = z.infer<typeof saleFormSchema>;

// This type will be used for the data sent to the server action
export type RecordSaleActionPayload = SaleFormData & {
  items: (SaleItemFormData & { productNameSnapshot: string; unitSnapshot: ProductUnit; total: number })[];
  totalAmount: number;
};
