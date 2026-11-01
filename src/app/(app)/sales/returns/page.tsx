import { Suspense } from 'react';
import { getSaleReturnsAction } from './actions';
import { ReturnsListClientContent } from './returns-list-client-content';
import { Loader2 } from 'lucide-react';

export const metadata = {
  title: 'Sales Returns & Credit Notes - WholesaleWise',
  description: 'Manage sales returns, credit notes, and customer refunds.',
};

export default async function SalesReturnsPage() {
  const returns = await getSaleReturnsAction();

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReturnsListClientContent initialReturns={returns} />
    </Suspense>
  );
}
