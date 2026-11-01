import { getPurchaseBillByIdAction } from '../actions';
import { getSession } from '@/app/login/actions';
import { notFound, redirect } from 'next/navigation';
import { PurchaseBillDetailClient } from './purchase-bill-detail-client';

interface PurchaseDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: 'Purchase Bill Details | WholesaleWise',
  description: 'View purchase inward bill, supplier information, itemized costs, and stock addition receipt.',
};

export default async function PurchaseDetailPage({ params }: PurchaseDetailPageProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const bill = await getPurchaseBillByIdAction(id);

  if (!bill) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <PurchaseBillDetailClient
        bill={bill}
        userRole={session.role}
        shopDetails={{
          shopName: session.shopName,
          shopAddress: session.shopAddress,
          shopContact: session.shopContact,
        }}
      />
    </div>
  );
}
