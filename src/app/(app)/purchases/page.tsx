import { getPurchaseBillsAction } from './actions';
import { getSession } from '@/app/login/actions';
import { redirect } from 'next/navigation';
import { PurchasesClientContent } from './purchases-client-content';

export const metadata = {
  title: 'Purchases & Inward Stock | WholesaleWise',
  description: 'Manage supplier purchases, inward stock bills, and track supplier payables.',
};

export default async function PurchasesPage() {
  const [session, purchaseBills] = await Promise.all([
    getSession(),
    getPurchaseBillsAction(),
  ]);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto py-6">
      <PurchasesClientContent
        initialBills={purchaseBills}
        userRole={session.role}
      />
    </div>
  );
}
