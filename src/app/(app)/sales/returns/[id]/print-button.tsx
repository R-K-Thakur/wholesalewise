'use client';

import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

export function PrintCreditNoteButton() {
  return (
    <Button onClick={() => window.print()} className="gap-2 shadow-sm">
      <Printer className="h-4 w-4" /> Print Credit Note
    </Button>
  );
}
