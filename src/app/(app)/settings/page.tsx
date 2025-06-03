
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = "app-theme";

export default function UserSettingsPage() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme) {
      const initialThemeDark = storedTheme === 'dark';
      setIsDarkTheme(initialThemeDark);
      document.documentElement.classList.toggle('dark', initialThemeDark);
    } else {
      // Default to system preference or light mode if no preference stored
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkTheme(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return; // Don't run on initial mount until client state is confirmed
    document.documentElement.classList.toggle('dark', isDarkTheme);
    localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme, isMounted]);

  const handleThemeChange = (checked: boolean) => {
    setIsDarkTheme(checked);
  };

  if (!isMounted) {
    // Avoid rendering UI that depends on client-side state until mounted
    // to prevent hydration mismatches, especially with theme.
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
