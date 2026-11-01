import { getCustomersAction } from "./actions";
import { CustomersClientContent } from "./customers-client-content";

export const metadata = {
  title: "Customers & Dues | WholesaleWise",
  description: "View customer profiles, outstanding dues, and ledger history.",
};

export default async function CustomersPage() {
  const customers = await getCustomersAction();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Customer Profiles & Dues</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track customer accounts, outstanding due balances, and transaction history.
        </p>
      </div>

      <CustomersClientContent initialCustomers={customers} />
    </div>
  );
}
