
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Moon, Sun, ListOrdered, CalendarDays, SlidersHorizontal } from 'lucide-react'; // Added CalendarDays, SlidersHorizontal

const THEME_STORAGE_KEY = "app-theme";
const ITEMS_PER_PAGE_STORAGE_KEY = "app-items-per-page";
const DEFAULT_SALE_TYPE_STORAGE_KEY = "app-default-sale-type";
const DEFAULT_TREND_RANGE_STORAGE_KEY = "app-default-trend-range"; // New key

const ITEMS_PER_PAGE_OPTIONS = ["10", "25", "50"];
const SALE_TYPE_OPTIONS = [
  { value: "retail", label: "Retail" },
  { value: "wholesale", label: "Wholesale" },
];
const TREND_DATE_RANGE_OPTIONS = [ // New options
  { value: "7", label: "Last 7 Days" },
  { value: "30", label: "Last 30 Days" },
  { value: "90", label: "Last 90 Days" },
];


export default function UserSettingsPage() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
  const [defaultSaleType, setDefaultSaleType] = useState(SALE_TYPE_OPTIONS[0].value);
  const [defaultTrendRange, setDefaultTrendRange] = useState(TREND_DATE_RANGE_OPTIONS[1].value); // New state
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Theme
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

    // Items per page
    const storedItemsPerPage = localStorage.getItem(ITEMS_PER_PAGE_STORAGE_KEY);
    if (storedItemsPerPage && ITEMS_PER_PAGE_OPTIONS.includes(storedItemsPerPage)) {
      setItemsPerPage(storedItemsPerPage);
    }

    // Default Sale Type
    const storedDefaultSaleType = localStorage.getItem(DEFAULT_SALE_TYPE_STORAGE_KEY);
    if (storedDefaultSaleType && SALE_TYPE_OPTIONS.some(opt => opt.value === storedDefaultSaleType)) {
      setDefaultSaleType(storedDefaultSaleType);
    }

    // Default Trend Date Range
    const storedDefaultTrendRange = localStorage.getItem(DEFAULT_TREND_RANGE_STORAGE_KEY);
    if (storedDefaultTrendRange && TREND_DATE_RANGE_OPTIONS.some(opt => opt.value === storedDefaultTrendRange)) {
      setDefaultTrendRange(storedDefaultTrendRange);
    }

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
    localStorage.setItem(DEFAULT_SALE_TYPE_STORAGE_KEY, defaultSaleType);
  }, [defaultSaleType, isMounted]);

  useEffect(() => { // New effect for trend range
    if (!isMounted) return;
    localStorage.setItem(DEFAULT_TREND_RANGE_STORAGE_KEY, defaultTrendRange);
  }, [defaultTrendRange, isMounted]);

  const handleThemeChange = (checked: boolean) => {
    setIsDarkTheme(checked);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(value);
  };

  const handleDefaultSaleTypeChange = (value: string) => {
    setDefaultSaleType(value);
  };

  const handleDefaultTrendRangeChange = (value: string) => { // New handler
    setDefaultTrendRange(value);
  };

  if (!isMounted) {
    return null; 
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
          <CardTitle>Data Entry Preferences</CardTitle>
          <CardDescription>Set defaults for data entry forms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-md">
            <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5" />
              <Label htmlFor="default-sale-type-select" className="text-base">
                Default Sale Type
              </Label>
            </div>
            <Select value={defaultSaleType} onValueChange={handleDefaultSaleTypeChange}>
              <SelectTrigger id="default-sale-type-select" className="w-[120px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {SALE_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose the default sale type (Retail or Wholesale) for the "Record New Sale" form.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard Preferences</CardTitle>
          <CardDescription>Customize your dashboard view.</CardDescription>
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
              <SelectTrigger id="default-trend-range-select" className="w-[150px]">
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
