"use client";

import * as React from "react";
import Link from "next/link";
import {
  RotateCcw,
  PlusCircle,
  Search,
  ArrowLeft,
  Calendar,
  User,
  FileText,
  BadgeAlert,
  TrendingDown,
  CheckCircle2,
  Package,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SaleReturn } from "@/lib/types";

interface ReturnsListClientContentProps {
  initialReturns: SaleReturn[];
}

export function ReturnsListClientContent({ initialReturns }: ReturnsListClientContentProps) {
  const [returns] = React.useState<SaleReturn[]>(initialReturns);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [refundMethodFilter, setRefundMethodFilter] = React.useState<string>("all");

  const filteredReturns = React.useMemo(() => {
    return returns.filter((ret) => {
      const matchesSearch =
        ret.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ret.saleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ret.customerName && ret.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ret.customerPhone && ret.customerPhone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ret.returnReason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMethod = refundMethodFilter === "all" || ret.refundMethod === refundMethodFilter;

      return matchesSearch && matchesMethod;
    });
  }, [returns, searchTerm, refundMethodFilter]);

  // KPIs
  const totalReturnAmount = React.useMemo(() => {
    return returns.reduce((sum, r) => sum + r.totalReturnAmount, 0);
  }, [returns]);

  const totalRestockedUnits = React.useMemo(() => {
    return returns.reduce((sum, r) => {
      const resellable = r.items.filter((i) => i.condition === "resellable");
      return sum + resellable.reduce((itemSum, item) => itemSum + item.quantityReturned, 0);
    }, 0);
  }, [returns]);

  const totalDamagedUnits = React.useMemo(() => {
    return returns.reduce((sum, r) => {
      const damaged = r.items.filter((i) => i.condition === "damaged");
      return sum + damaged.reduce((itemSum, item) => itemSum + item.quantityReturned, 0);
    }, 0);
  }, [returns]);

  const getRefundMethodBadge = (method: string) => {
    switch (method) {
      case "deduct_customer_due":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">Deducted from Due</Badge>;
      case "cash":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Cash Refund</Badge>;
      case "store_credit":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-200">Store Credit</Badge>;
      default:
        return <Badge variant="secondary">{method}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground">
              <Link href="/sales">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sales
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" /> Sales Returns & Credit Notes
          </h1>
          <p className="text-sm text-muted-foreground">
            Register of customer returns, stock restorations, and issued credit notes.
          </p>
        </div>

        <Button asChild className="gap-2 shadow-sm">
          <Link href="/sales/returns/new">
            <PlusCircle className="h-4 w-4" /> Process Return
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Returned Value</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">Rs. {totalReturnAmount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Total credit notes & refunds issued</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credit Notes Issued</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{returns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total return vouchers recorded</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Restocked Units</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalRestockedUnits}</div>
            <p className="text-xs text-muted-foreground mt-1">Resellable items added back to stock</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Damaged Units</CardTitle>
            <BadgeAlert className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalDamagedUnits}</div>
            <p className="text-xs text-muted-foreground mt-1">Scrapped / written off as damage</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Return #, Invoice #, Customer name, or Reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={refundMethodFilter} onValueChange={setRefundMethodFilter}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Filter by Settlement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Settlements</SelectItem>
                  <SelectItem value="deduct_customer_due">Deducted from Due</SelectItem>
                  <SelectItem value="cash">Cash Refund</SelectItem>
                  <SelectItem value="store_credit">Store Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns Table */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-base font-semibold">Returns Register</CardTitle>
          <CardDescription>
            Showing {filteredReturns.length} of {returns.length} processed returns
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredReturns.length === 0 ? (
            <div className="text-center py-12 px-4">
              <RotateCcw className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-medium text-foreground">No return records found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm || refundMethodFilter !== "all"
                  ? "No returns matched your search criteria."
                  : "No customer returns have been processed yet. When a customer returns items, use 'Process Return' to record it."}
              </p>
              {!searchTerm && refundMethodFilter === "all" && (
                <Button asChild variant="outline" className="mt-4 gap-2">
                  <Link href="/sales/returns/new">
                    <PlusCircle className="h-4 w-4" /> Process First Return
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/40 border-b">
                  <tr>
                    <th scope="col" className="px-6 py-3">Return #</th>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Original Invoice</th>
                    <th scope="col" className="px-6 py-3">Customer</th>
                    <th scope="col" className="px-6 py-3">Items Returned</th>
                    <th scope="col" className="px-6 py-3">Settlement</th>
                    <th scope="col" className="px-6 py-3 text-right">Credit Amount</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap font-mono font-semibold text-primary">
                        <Link href={`/sales/returns/${ret.id}`} className="hover:underline">
                          {ret.returnNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap text-muted-foreground text-xs">
                        {ret.returnDate}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap font-mono text-xs">
                        <Link href={`/sales/${ret.saleId}`} className="hover:underline text-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          #{ret.saleId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-6 py-3.5 font-medium text-foreground">
                        {ret.customerName ? (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-sm">
                              <User className="h-3.5 w-3.5 text-muted-foreground" /> {ret.customerName}
                            </span>
                            {ret.customerPhone && (
                              <span className="text-xs text-muted-foreground">{ret.customerPhone}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Walk-in</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {ret.items.map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs font-normal">
                              {item.quantityReturned} {item.unit} {item.productNameSnapshot}
                              {item.condition === "damaged" && " (Damaged)"}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Reason: {ret.returnReason}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        {getRefundMethodBadge(ret.refundMethod)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap font-bold text-foreground">
                        Rs. {ret.totalReturnAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                          <Link href={`/sales/returns/${ret.id}`}>
                            View Credit Note
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
