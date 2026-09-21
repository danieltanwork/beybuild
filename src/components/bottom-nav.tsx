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
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-background-elevated/90 backdrop-blur-lg">
      {links.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-neon-cyan" : "text-muted-foreground"
            }`}
          >
            <span
              className={`text-xl leading-none ${active ? "drop-shadow-[0_0_6px_#22e8f5]" : ""}`}
            >
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
