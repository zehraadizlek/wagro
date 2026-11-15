"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/farm", label: "My farm" },
  { href: "/rotation", label: "Results" },
  { href: "/report", label: "Report" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-4 sm:px-4">
        <div className="mx-auto flex max-w-6xl items-center gap-2 rounded-full border border-line bg-paper p-1.5 shadow-[0_4px_16px_rgba(46,50,41,0.05)]">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1 rounded-full pl-2 pr-1 py-1.5 font-display text-xl leading-none text-espresso sm:px-4 sm:text-2xl"
          >
            wagro
            <span className="h-2 w-2 rounded-full bg-accent" />
          </Link>
          <nav className="flex min-w-0 gap-0.5 sm:gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium sm:px-4 sm:text-sm transition-colors duration-200 ${
                    active
                      ? "bg-sage text-espresso"
                      : "text-muted hover:text-espresso"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-14">{children}</main>

      <footer className="mx-auto max-w-6xl border-t border-line px-5 py-6 text-xs text-muted">
        Wagro is a prototype built for NASA Space Apps Challenge 2026. It does
        not replace professional agronomic advice.{" "}
        <Link href="/how" className="underline hover:text-espresso">
          How Wagro works
        </Link>
      </footer>
    </div>
  );
}