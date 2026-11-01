import { Suspense } from 'react';
import { getInventoryAdjustmentsAction } from './actions';
import { getProductsAction } from '../actions';
import { getSession } from '@/app/login/actions';
import { AdjustmentsClientContent } from './adjustments-client-content';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Stock Adjustments & Waste Log - WholesaleWise',
  description: 'Manage damaged goods, expired stock, and inventory audit adjustments.',
};

export default async function InventoryAdjustmentsPage() {
  const [adjustments, products, session] = await Promise.all([
    getInventoryAdjustmentsAction(),
    getProductsAction(),
    getSession(),
  ]);

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AdjustmentsClientContent
        initialAdjustments={adjustments}
        products={products}
        currentUserRole={session?.role}
      />
    </Suspense>
  );
}
