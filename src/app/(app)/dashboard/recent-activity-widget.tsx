
"use client";

import * as React from 'react';
import Link from 'next/link';
import type { ActivityItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ArrowRight, PackagePlus, ShoppingCart, Search } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RecentActivityWidgetProps {
  activities: ActivityItem[];
}

const typeToIconMap = {
  sale: ShoppingCart,
  purchase: PackagePlus,
};

export function RecentActivityWidget({ activities }: RecentActivityWidgetProps) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredActivities = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return activities;
    }
    const lowercasedSearchTerm = searchTerm.toLowerCase().trim();
    return activities.filter(activity =>
      activity.description.toLowerCase().includes(lowercasedSearchTerm) ||
      (activity.recordedByName && activity.recordedByName.toLowerCase().includes(lowercasedSearchTerm)) ||
      (activity.recordedByEmail && activity.recordedByEmail.toLowerCase().includes(lowercasedSearchTerm))
    );
  }, [activities, searchTerm]);

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No recent activity to display.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full md:w-1/2 lg:w-1/3"
            />
          </div>
        </div>

        {filteredActivities.length === 0 && searchTerm.trim() !== "" && (
          <p className="text-muted-foreground text-center py-4">No activities found matching your search.</p>
        )}

        {filteredActivities.length > 0 && (
          <ScrollArea className="h-[350px] pr-3">
            <div className="space-y-3">
              {filteredActivities.map((activity) => {
                const IconComponent = typeToIconMap[activity.type] || PackagePlus;
                let timeAgo = 'some time ago';
                try {
                  if (activity.date) {
                      timeAgo = formatDistanceToNow(parseISO(activity.date), { addSuffix: true });
                  }
                } catch (e) {
                  console.warn(`Error parsing date for activity ${activity.id}: ${activity.date}`, e);
                }

                let descriptionWithUser = activity.description;
                const recordedBy = activity.recordedByName || activity.recordedByEmail;
                if (recordedBy) {
                  descriptionWithUser += ` by ${recordedBy}`;
                }

                return (
                  <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 p-3 border rounded-lg shadow-sm hover:bg-muted/30 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{descriptionWithUser}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo}</p>
                    </div>
                    {activity.link && (
                      <Button variant="ghost" size="icon" asChild className="flex-shrink-0 self-center ml-auto h-8 w-8">
                        <Link href={activity.link} aria-label="View details">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
        {filteredActivities.length === 0 && searchTerm.trim() === "" && activities.length > 0 && (
           <p className="text-muted-foreground text-center py-4">No activities to display.</p>
        )}
      </CardContent>
    </Card>
  );
}
