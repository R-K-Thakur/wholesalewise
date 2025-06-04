
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Sale } from "@/lib/types";
import { TREND_DATE_RANGE_OPTIONS, DEFAULT_TREND_RANGE_STORAGE_KEY } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, format, parseISO, startOfDay } from 'date-fns';
import { Loader2 } from "lucide-react";

interface SalesTrendChartProps {
  sales: Sale[];
}

const chartConfig = {
  totalSales: {
    label: "Sales (\u20B9)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export function SalesTrendChart({ sales }: SalesTrendChartProps) {
  const [processedChartData, setProcessedChartData] = React.useState<Array<{ date: string; totalSales: number }>>([]);
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
    if (!isMounted || !sales || sales.length === 0) {
      setProcessedChartData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const now = new Date();
    const rangeInDays = parseInt(selectedRange, 10);
    const startDate = subDays(startOfDay(now), rangeInDays -1); // -1 because we include today

    const dailySales: Record<string, number> = {};

    // Initialize daily sales with 0 for all days in the range
    for (let i = 0; i < rangeInDays; i++) {
        const dateKey = format(subDays(startOfDay(now), i), 'yyyy-MM-dd');
        dailySales[dateKey] = 0;
    }

    sales.forEach(sale => {
      try {
        const saleDate = startOfDay(parseISO(sale.saleDate));
        if (saleDate >= startDate && saleDate <= now) {
          const dateKey = format(saleDate, 'yyyy-MM-dd');
          dailySales[dateKey] = (dailySales[dateKey] || 0) + sale.totalAmount;
        }
      } catch (error) {
        console.warn(`Skipping sale due to invalid date format: ${sale.saleDate}`, sale);
      }
    });
    
    const chartData = Object.entries(dailySales)
      .map(([date, totalSales]) => ({
        date: format(parseISO(date), "MMM d"), // Format for display
        fullDate: date, // Keep for sorting
        totalSales: parseFloat(totalSales.toFixed(2)),
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime())
      .map(({date, totalSales}) => ({date, totalSales})); // Remove fullDate after sorting

    setProcessedChartData(chartData);
    setIsLoading(false);
  }, [sales, selectedRange, isMounted]);

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
            <CardTitle>Sales Trends</CardTitle>
            <CardDescription>
                Showing total sales for the selected period. Current default is '{currentRangeLabel}'.
            </CardDescription>
        </div>
        <Select value={selectedRange} onValueChange={handleRangeChange} disabled={!isMounted}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Select sales trend date range">
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
            <p className="text-muted-foreground">No sales data available for the selected period.</p>
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
                tickFormatter={(value) => `\u20B9${value.toLocaleString()}`}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={80}
              />
              <RechartsTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dashed" />}
              />
              <Bar dataKey="totalSales" fill="var(--color-totalSales)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
