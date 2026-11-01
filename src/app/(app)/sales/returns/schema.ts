import { z } from 'zod';
import { PRODUCT_UNITS } from '@/lib/constants';

export const returnReasonOptions = [
  'Defective / Damaged product',
  'Wrong item delivered',
  'Customer ordered excess / Change of mind',
  'Near expiry / Expired item',
  'Quality issue / Substandard batch',
  'Billing / Invoice correction',
  'Other reason',
];

export const saleReturnItemSchema = z.object({
  productId: z.string().optional(),
  productNameSnapshot: z.string().min(1, 'Product name is required'),
  quantityReturned: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0'),
  unit: z.enum(PRODUCT_UNITS as unknown as [string, ...string[]]),
  pricePerUnit: z.coerce.number().min(0, 'Price cannot be negative'),
  condition: z.enum(['resellable', 'damaged'], {
    required_error: 'Please select product condition',
  }),
});

export const saleReturnFormSchema = z.object({
  saleId: z.string().min(1, 'Original sale invoice ID is required'),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(saleReturnItemSchema).min(1, 'At least one item must be returned'),
  refundMethod: z.enum(['cash', 'deduct_customer_due', 'store_credit'], {
    required_error: 'Please select a refund / credit method',
  }),
  returnReason: z.string().min(2, 'Return reason is required'),
  notes: z.string().optional(),
  returnDate: z.string().optional(),
});

export type SaleReturnFormData = z.infer<typeof saleReturnFormSchema>;
export type SaleReturnItemFormData = z.infer<typeof saleReturnItemSchema>;
