import { Suspense } from 'react';
import { getSaleByIdAction, getSalesAction } from '@/app/(app)/sales/actions';
import { getSaleReturnsForSaleAction } from '../actions';
import { ReturnFormClient } from './return-form-client';
import { Loader2 } from 'lucide-react';
import type { Sale, SaleReturn } from '@/lib/types';

export const metadata = {
  title: 'Process Return / Credit Note - WholesaleWise',
  description: 'Process customer returns and issue credit notes',
};

interface NewReturnPageProps {
  searchParams: Promise<{ saleId?: string }>;
}

export default async function NewReturnPage({ searchParams }: NewReturnPageProps) {
  const resolvedParams = await searchParams;
  const saleId = resolvedParams.saleId;

  let initialSale: Sale | null = null;
  let previousReturns: SaleReturn[] = [];

  const allSales = await getSalesAction();

  if (saleId) {
    const saleResult = await getSaleByIdAction(saleId);
    if (saleResult) {
      initialSale = saleResult;
      previousReturns = await getSaleReturnsForSaleAction(saleId);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReturnFormClient
        initialSale={initialSale}
        allSales={allSales}
        previousReturnsForSale={previousReturns}
      />
    </Suspense>
  );
}
