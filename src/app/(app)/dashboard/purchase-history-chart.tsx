
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Purchase, PurchaseTrend } from "@/lib/types";
import { TREND_DATE_RANGE_OPTIONS, DEFAULT_TREND_RANGE_STORAGE_KEY } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subDays, format, parseISO, startOfDay } from 'date-fns';
import { Loader2 } from "lucide-react";

interface PurchaseHistoryChartProps {
  purchases: Purchase[];
}

const chartConfig = {
  totalPurchases: {
    label: `Purchases (${String.fromCharCode(8377)})`, // Using chart-2 color for differentiation
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function PurchaseHistoryChart({ purchases }: PurchaseHistoryChartProps) {
  const [processedChartData, setProcessedChartData] = React.useState<PurchaseTrend[]>([]);
  const [selectedRange, setSelectedRange] = React.useState<string>(TREND_DATE_RANGE_OPTIONS[1].value); // Default to "Last 30 Days"
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    const storedRange = localStorage.getItem(DEFAULT_TREND_RANGE_STORAGE_KEY);
    if (storedRange && TREND_DATE_RANGE_OPTIONS.some(opt => opt.value === storedRange)) {
      setSelectedRange(storedRange);
    }
  }, []);

  React.useEffect(() => {
    if (!isMounted || !purchases) {
      setProcessedChartData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const now = new Date();
    const rangeInDays = parseInt(selectedRange, 10);
    const startDateBoundary = subDays(startOfDay(now), rangeInDays -1);

    const dailyPurchases: Record<string, number> = {};

    // Initialize daily purchases with 0 for all days in the range
    for (let i = 0; i < rangeInDays; i++) {
        const dateKey = format(subDays(startOfDay(now), i), 'yyyy-MM-dd');
        dailyPurchases[dateKey] = 0;
    }
    
    if (purchases.length > 0) {
        purchases.forEach(purchase => {
        try {
            const purchaseEventDate = startOfDay(parseISO(purchase.purchaseDate)); // Use purchaseDate for actual event time
            if (purchaseEventDate >= startDateBoundary && purchaseEventDate <= now) {
            const dateKey = format(purchaseEventDate, 'yyyy-MM-dd');
            dailyPurchases[dateKey] = (dailyPurchases[dateKey] || 0) + purchase.totalCost;
            }
        } catch (error) {
            console.warn(`Skipping purchase due to invalid date format: ${purchase.purchaseDate}`, purchase);
        }
        });
    }
    
    const chartData = Object.entries(dailyPurchases)
      .map(([date, totalPurchases]) => ({
        date: format(parseISO(date), "MMM d"), // Format for display
        fullDate: date, // Keep for sorting
        totalPurchases: parseFloat(totalPurchases.toFixed(2)),
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .map(({date, totalPurchases}) => ({date, totalPurchases}));

    setProcessedChartData(chartData);
    setIsLoading(false);
  }, [purchases, selectedRange, isMounted]);

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    if (isMounted) {
      localStorage.setItem(DEFAULT_TREND_RANGE_STORAGE_KEY, value);
    }
  };
  
  const currentRangeLabel = isMounted ? 
    (TREND_DATE_RANGE_OPTIONS.find(opt => opt.value === selectedRange)?.label || selectedRange + " Days") : 
    (TREND_DATE_RANGE_OPTIONS.find(opt => opt.value === TREND_DATE_RANGE_OPTIONS[1].value)?.label);


  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle>Purchase History Trends</CardTitle>
          <CardDescription>
            Showing total purchase costs for the selected period. Current default is '{currentRangeLabel}'.
          </CardDescription>
        </div>
        <Select value={selectedRange} onValueChange={handleRangeChange} disabled={!isMounted}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Select purchase trend date range">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            {TREND_DATE_RANGE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading && isMounted ? (
            <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading chart data...</p>
            </div>
        ) : !isMounted ? (
             <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Initializing chart...</p>
            </div>
        ) : processedChartData.length === 0 && isMounted ? (
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">No purchase data available for the selected period.</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={processedChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 6)}
              />
              <YAxis
                tickFormatter={(value) => `${String.fromCharCode(8377)}${value.toLocaleString()}`}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={80}
              />
              <RechartsTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar dataKey="totalPurchases" fill="var(--color-totalPurchases)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

