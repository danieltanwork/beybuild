"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@stackframe/stack";

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 10v8.5a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function BuildIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

const links = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/inventory", label: "Inventory", Icon: InventoryIcon },
  { href: "/build", label: "Build", Icon: BuildIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const user = useUser();

  if (!user || pathname.startsWith("/handler")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 flex border-t border-border bg-background-elevated/90 backdrop-blur-lg">
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-neon-cyan" : "text-muted-foreground"
            }`}
          >
            <Icon
              className={`h-6 w-6 ${active ? "drop-shadow-[0_0_6px_#22e8f5]" : ""}`}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
