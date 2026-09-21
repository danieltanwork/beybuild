"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@stackframe/stack";

const links = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/inventory", label: "Inventory", icon: "📦" },
  { href: "/build", label: "Build", icon: "🌀" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const user = useUser();

  if (!user || pathname.startsWith("/handler")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              active
                ? "text-zinc-950 dark:text-zinc-50"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            <span className="text-xl leading-none">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
