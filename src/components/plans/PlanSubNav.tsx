"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "process-flow", label: "Process Flow" },
  { href: "ingredients", label: "Ingredients" },
  { href: "ccp-summary", label: "CCP Summary" },
  { href: "documents", label: "Documents" },
  { href: "versions", label: "Versions" },
  { href: "export", label: "Export PDF" },
];

export function PlanSubNav({ planId }: { planId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-0 mt-4 -mb-px">
      {TABS.map((tab) => {
        const href = `/plans/${planId}/${tab.href}`;
        const isActive = pathname.startsWith(href) ||
          (tab.href === "process-flow" && pathname.includes("/steps/"));
        return (
          <Link
            key={tab.href}
            href={href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              isActive
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
