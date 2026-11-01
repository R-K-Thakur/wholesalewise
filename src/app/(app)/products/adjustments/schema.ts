import { z } from 'zod';
import type { InventoryAdjustmentType } from '@/lib/types';

export const adjustmentTypeOptions: { value: InventoryAdjustmentType; label: string; description: string; defaultDirection: 'decrease' | 'increase' }[] = [
  { value: 'damage', label: 'Damaged / Broken / Leaked', description: 'Stock ruined in handling or storage', defaultDirection: 'decrease' },
  { value: 'expiry', label: 'Expired / Past Best-Before', description: 'Product crossed expiration date', defaultDirection: 'decrease' },
  { value: 'theft_or_loss', label: 'Theft / Missing Stock', description: 'Missing items unaccounted for', defaultDirection: 'decrease' },
  { value: 'audit_discrepancy', label: 'Physical Audit Discrepancy', description: 'Correction to match physical floor count', defaultDirection: 'increase' },
  { value: 'internal_use', label: 'Internal Use / Tasting / Samples', description: 'Used for demonstration or store operations', defaultDirection: 'decrease' },
  { value: 'other', label: 'Other Stock Correction', description: 'Other manual inventory adjustment', defaultDirection: 'decrease' },
];

export const inventoryAdjustmentFormSchema = z.object({
  productId: z.string().min(1, 'Please select a product.'),
  type: z.enum(['damage', 'expiry', 'audit_discrepancy', 'theft_or_loss', 'internal_use', 'other'], {
    required_error: 'Please select an adjustment reason type.',
  }),
  direction: z.enum(['decrease', 'increase'], {
    required_error: 'Please select whether stock is being added or deducted.',
  }),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a number.' })
    .positive('Quantity must be greater than 0.'),
  reason: z.string().min(2, 'Please provide a reason or explanation.'),
  notes: z.string().optional(),
  date: z.string().optional(),
});

export type InventoryAdjustmentFormData = z.infer<typeof inventoryAdjustmentFormSchema>;
