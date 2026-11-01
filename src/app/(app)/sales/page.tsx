
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getSalesAction } from "./actions";
import { getSession } from "@/app/login/actions";
import { SalesListClientContent } from "./sales-list-client-content";


export default async function SalesPage() {
  const [sales, session] = await Promise.all([
    getSalesAction(),
    getSession(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Sales Records</h1>
          <p className="text-sm text-muted-foreground">View and manage all recorded wholesale sales transactions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/sales/returns">
              <RotateCcw className="mr-2 h-4 w-4" />
              Returns & Credit Notes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales/new">
              <PlusCircle className="mr-2 h-5 w-5" />
              Record New Sale
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
          <CardDescription>View and manage all recorded sales transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <SalesListClientContent sales={sales} initialRole={session?.role} />
        </CardContent>
      </Card>
    </div>
  );
}
