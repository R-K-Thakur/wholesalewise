
"use client";

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Moon, Sun, ListOrdered, CalendarDays, Palette, Save, Loader2 } from 'lucide-react';
import { 
  DEFAULT_TREND_RANGE_STORAGE_KEY, 
  TREND_DATE_RANGE_OPTIONS,
  ITEMS_PER_PAGE_STORAGE_KEY
} from '@/lib/constants';
import { getSession, updateUserInvoiceColorAction, type SessionData } from "@/app/login/actions";
import { useToast } from "@/hooks/use-toast";


const THEME_STORAGE_KEY = "app-theme";
const ITEMS_PER_PAGE_OPTIONS = ["10", "25", "50"];
const DEFAULT_INVOICE_COLOR_HEX = "#73A7B3"; // Muted Teal

export default function UserSettingsPage() {
  const { toast } = useToast();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [defaultTrendRange, setDefaultTrendRange] = useState(TREND_DATE_RANGE_OPTIONS[1].value); 
  
  const [invoiceColor, setInvoiceColor] = useState(DEFAULT_INVOICE_COLOR_HEX);
  const [isSavingInvoiceColor, setIsSavingInvoiceColor] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function fetchInitialSettings() {
      const currentSession = await getSession();
      setSession(currentSession);

      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme) {
        const initialThemeDark = storedTheme === 'dark';
        setIsDarkTheme(initialThemeDark);
        document.documentElement.classList.toggle('dark', initialThemeDark);
      } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkTheme(prefersDark);
        document.documentElement.classList.toggle('dark', prefersDark);
      }

      const storedItemsPerPage = localStorage.getItem(ITEMS_PER_PAGE_STORAGE_KEY);
      if (storedItemsPerPage && ITEMS_PER_PAGE_OPTIONS.includes(storedItemsPerPage)) {
        setItemsPerPage(storedItemsPerPage);
      }

      const storedDefaultTrendRange = localStorage.getItem(DEFAULT_TREND_RANGE_STORAGE_KEY);
      if (storedDefaultTrendRange && TREND_DATE_RANGE_OPTIONS.some(opt => opt.value === storedDefaultTrendRange)) {
        setDefaultTrendRange(storedDefaultTrendRange);
      }
      
      if (currentSession?.invoicePrimaryColor) {
        setInvoiceColor(currentSession.invoicePrimaryColor);
      }
    }
    fetchInitialSettings();
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    document.documentElement.classList.toggle('dark', isDarkTheme);
    localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem(ITEMS_PER_PAGE_STORAGE_KEY, itemsPerPage);
  }, [itemsPerPage, isMounted]);

  useEffect(() => { 
    if (!isMounted) return;
    localStorage.setItem(DEFAULT_TREND_RANGE_STORAGE_KEY, defaultTrendRange);
  }, [defaultTrendRange, isMounted]);

  const handleThemeChange = (checked: boolean) => {
    setIsDarkTheme(checked);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(value);
  };

  const handleDefaultTrendRangeChange = (value: string) => { 
    setDefaultTrendRange(value);
  };

  const handleInvoiceColorSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingInvoiceColor(true);
    const result = await updateUserInvoiceColorAction(invoiceColor);
    if (result.success) {
      toast({ title: "Success", description: "Invoice color updated successfully." });
      const updatedSession = await getSession(); // Re-fetch to get the latest session data
      setSession(updatedSession); // Update local session state
    } else {
      toast({ title: "Error", description: result.message || "Failed to update invoice color.", variant: "destructive" });
    }
    setIsSavingInvoiceColor(false);
  };

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground mt-4">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight font-headline">My Settings</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize the look and feel of the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center gap-2">
              {isDarkTheme ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <Label htmlFor="theme-toggle" className="text-base">
                Dark Mode
              </Label>
            </div>
            <Switch
              id="theme-toggle"
              checked={isDarkTheme}
              onCheckedChange={handleThemeChange}
              aria-label="Toggle dark mode"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Change the application&apos;s color scheme. Your preference will be saved for your next visit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Customization</CardTitle>
          <CardDescription>Personalize the appearance of your PDF invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvoiceColorSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                <Label htmlFor="invoice-color-picker" className="text-base">
                  Invoice Accent Color
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="invoice-color-picker"
                  type="color"
                  value={invoiceColor}
                  onChange={(e) => setInvoiceColor(e.target.value)}
                  className="w-20 h-10 p-1"
                  disabled={isSavingInvoiceColor}
                />
                <Button type="submit" size="sm" disabled={isSavingInvoiceColor || invoiceColor === (session?.invoicePrimaryColor || DEFAULT_INVOICE_COLOR_HEX)}>
                  {isSavingInvoiceColor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="hidden sm:inline ml-1">Save Color</span>
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose the primary accent color used for elements like table headers in your PDF invoices.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
          <CardDescription>Control how data is displayed in tables and lists.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              <Label htmlFor="items-per-page-select" className="text-base">
                Items Per Page
              </Label>
            </div>
            <Select value={itemsPerPage} onValueChange={handleItemsPerPageChange}>
              <SelectTrigger id="items-per-page-select" className="w-[100px]">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Set the default number of items shown in paginated lists (e.g., Products, Sales).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Customization</CardTitle>
          <CardDescription>Personalize your dashboard view and data presentation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              <Label htmlFor="default-trend-range-select" className="text-base">
                Default Trend Date Range
              </Label>
            </div>
            <Select value={defaultTrendRange} onValueChange={handleDefaultTrendRangeChange}>
              <SelectTrigger id="default-trend-range-select" className="w-[180px] sm:w-[200px]">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                {TREND_DATE_RANGE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Set the default date range for displaying sales and purchase trends on the dashboard.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Other user-specific settings will appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">More user-specific settings are coming soon!</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
