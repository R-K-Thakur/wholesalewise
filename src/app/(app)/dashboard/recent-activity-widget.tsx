
"use client";

import Link from 'next/link';
import type { ActivityItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, PackagePlus, ShoppingCart } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface RecentActivityWidgetProps {
  activities: ActivityItem[];
}

const typeToIconMap = {
  sale: ShoppingCart,
  purchase: PackagePlus,
};

export function RecentActivityWidget({ activities }: RecentActivityWidgetProps) {
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
        <ScrollArea className="h-[350px] pr-3">
          <div className="space-y-3">
            {activities.map((activity) => {
              const IconComponent = typeToIconMap[activity.type] || PackagePlus; // Default icon
              let timeAgo = 'some time ago';
              try {
                if (activity.date) {
                    timeAgo = formatDistanceToNow(parseISO(activity.date), { addSuffix: true });
                }
              } catch (e) {
                console.warn(`Error parsing date for activity ${activity.id}: ${activity.date}`, e);
              }

              return (
                <div key={`${activity.type}-${activity.id}`} className="flex items-start gap-3 p-3 border rounded-lg shadow-sm hover:bg-muted/30 transition-colors">
                  <div className="flex-shrink-0 mt-1">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-grow min-w-0"> {/* Added min-w-0 for text truncation */}
                    <p className="text-sm font-medium text-foreground truncate">{activity.description}</p>
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
      </CardContent>
    </Card>
  );
}
