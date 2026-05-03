"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navByRole } from "@/config/nav";
import type { UserRole } from "@/types/auth";
import { cn } from "@/lib/utils/cn";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = navByRole[role];

  return (
    <aside className="w-64 border-r border-zinc-200 bg-white p-4">
      <div className="mb-6 rounded-md bg-[var(--brand-muted)] p-3">
        <p className="text-xs uppercase tracking-wider text-zinc-600">Recomenda</p>
        <p className="text-sm font-semibold text-zinc-900">Web Console</p>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-[var(--brand)] text-white"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
