
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Moon, Sun, ListOrdered } from 'lucide-react';

const THEME_STORAGE_KEY = "app-theme";
const ITEMS_PER_PAGE_STORAGE_KEY = "app-items-per-page";
const ITEMS_PER_PAGE_OPTIONS = ["10", "25", "50"];

export default function UserSettingsPage() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0]);
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
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    // Theme
    document.documentElement.classList.toggle('dark', isDarkTheme);
    localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    // Items per page
    localStorage.setItem(ITEMS_PER_PAGE_STORAGE_KEY, itemsPerPage);
  }, [itemsPerPage, isMounted]);

  const handleThemeChange = (checked: boolean) => {
    setIsDarkTheme(checked);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(value);
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
          <CardDescription>Control how data is displayed in tables.</CardDescription>
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
              <SelectTrigger id="items-per-page-select" className="w-[80px]">
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
