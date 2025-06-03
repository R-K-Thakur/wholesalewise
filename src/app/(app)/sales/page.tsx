
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { getSalesAction } from "./actions";
// import type { Sale } from "@/lib/types"; // No longer directly used here
import { SalesListClientContent } from "./sales-list-client-content";


export default async function SalesPage() {
  const sales = await getSalesAction();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Sales Records</h1>
        <Button asChild>
          <Link href="/sales/new">
            <PlusCircle className="mr-2 h-5 w-5" />
            Record New Sale
          </Link>
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>All Sales</CardTitle>
          <CardDescription>View and manage all recorded sales transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* TODO: Implement Sales Filters component */}
          <p className="text-muted-foreground mb-4">Sales filters (date range, type, etc.) placeholder</p>
          
          <SalesListClientContent sales={sales} />
          
        </CardContent>
      </Card>
    </div>
  );
}
