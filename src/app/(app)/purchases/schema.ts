import { z } from 'zod';
import { PRODUCT_UNITS } from '@/lib/constants';

export const purchaseBillItemSchema = z.object({
  productId: z.string().min(1, { message: 'Please select a product.' }),
  quantityPurchased: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number.' })
    .positive({ message: 'Quantity must be greater than 0.' }),
  purchasePricePerUnit: z.coerce
    .number({ invalid_type_error: 'Price must be a number.' })
    .nonnegative({ message: 'Purchase price cannot be negative.' }),
  purchaseUnit: z.enum(PRODUCT_UNITS, {
    errorMap: () => ({ message: 'Please select a valid unit.' }),
  }),
});

export const purchaseBillFormSchema = z.object({
  supplierName: z.string().min(1, { message: 'Supplier/Vendor name is required.' }),
  supplierPhone: z.string().optional(),
  invoiceNumber: z.string().optional(),
  purchaseDate: z.string().min(1, { message: 'Purchase date is required.' }),
  items: z.array(purchaseBillItemSchema).min(1, { message: 'At least one item is required.' }),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'credit'], {
    errorMap: () => ({ message: 'Please select a payment method.' }),
  }),
  amountPaid: z.coerce
    .number({ invalid_type_error: 'Amount paid must be a number.' })
    .nonnegative({ message: 'Amount paid cannot be negative.' }),
  notes: z.string().optional(),
});

export type PurchaseBillFormValues = z.infer<typeof purchaseBillFormSchema>;
