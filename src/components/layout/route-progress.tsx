"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

function ProgressContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = React.useState(false);

  React.useEffect(() => {
    setIsNavigating(false);
  }, [pathname, searchParams]);

  React.useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("/") &&
        !href.startsWith("#") &&
        target.target !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (href !== window.location.pathname) {
          setIsNavigating(true);
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => document.removeEventListener("click", handleAnchorClick, { capture: true });
  }, []);

  if (!isNavigating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20 pointer-events-none overflow-hidden">
      <div className="h-full bg-primary animate-pulse w-full shadow-[0_0_10px_rgba(208,191,255,0.8)] transition-all duration-300" />
    </div>
  );
}

export function RouteProgressBar() {
  return (
    <React.Suspense fallback={null}>
      <ProgressContent />
    </React.Suspense>
  );
}
