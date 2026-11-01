import { getProductsAction } from '@/app/(app)/products/actions';
import { getPurchaseBillsAction } from '../actions';
import { getSession } from '@/app/login/actions';
import { redirect } from 'next/navigation';
import { PurchaseBillFormClient } from './purchase-bill-form-client';

export const metadata = {
  title: 'Record Inward Purchase | WholesaleWise',
  description: 'Record stock purchases and supplier bills to increase inventory.',
};

export default async function NewPurchasePage() {
  const [session, products, existingBills] = await Promise.all([
    getSession(),
    getProductsAction(),
    getPurchaseBillsAction(),
  ]);

  if (!session) {
    redirect('/login');
  }

  // Extract unique supplier names from existing bills for autocomplete
  const existingSuppliers = Array.from(
    new Set(existingBills.map((b) => b.supplierName).filter(Boolean))
  );

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <PurchaseBillFormClient
        products={products}
        existingSuppliers={existingSuppliers}
        userRole={session.role}
      />
    </div>
  );
}
