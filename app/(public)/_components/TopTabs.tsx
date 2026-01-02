"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type TabKey = "home" | "calendar" | "routine" | "goals" | "community" | undefined;

export default function TopTabs({ active }: { active?: TabKey }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer when route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  const tabs = useMemo(
    () => ([
      { key: "home" as TabKey,     href: "/",             label: "Dashboard" },
      { key: "calendar" as TabKey, href: "/deep-calendar",label: "Your Deep Calendar" },
      { key: "routine" as TabKey,  href: "/routine",      label: "Your Deep Routine" },
      { key: "goals" as TabKey,    href: "/goals",        label: "Goals" },
      { key: "community" as TabKey, href: "/community",   label: "Community" },
    ]),
    []
  );

  const isActive = (href: string, key: TabKey) =>
    active ? active === key : (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const pill =
    "rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 whitespace-nowrap transition-colors";
  const on = "bg-black text-white";
  const off = "bg-white hover:bg-gray-50";

  return (
    <div className="w-full">
      {/* Mobile: hamburger */}
      <div className="flex items-center justify-between sm:hidden">
        <div className="text-sm font-medium">Navigate</div>
        <button
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 ring-1 ring-gray-200"
        >
          {/* Hamburger icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
            <path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z" />
          </svg>
        </button>
      </div>

      {/* Desktop/Tablet: inline tabs */}
      <nav
        className="mt-2 hidden gap-2 sm:flex"
        role="tablist"
        aria-label="DeepCalendar sections"
      >
        {tabs.map((t) => (
          <Link
            key={String(t.key)}
            href={t.href}
            className={`${pill} ${isActive(t.href, t.key) ? on : off}`}
            aria-current={isActive(t.href, t.key) ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Drawer (mobile) */}
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div
            role="dialog"
            aria-modal="true"
            className="absolute right-0 top-0 h-full w-72 max-w-[85%] translate-x-0 bg-white shadow-xl ring-1 ring-black/5"
            style={{ transition: "transform 180ms ease-out" }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="text-sm font-semibold">Menu</div>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 ring-1 ring-gray-200"
              >
                {/* X icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
                  <path d="M18.3 5.71L12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82 18.3 21.11 19.71 19.7 13.41 13.4 19.71 7.11z" />
                </svg>
              </button>
            </div>
            <div className="p-3">
              <nav className="flex flex-col gap-2">
                {tabs.map((t) => (
                  <Link
                    key={String(t.key)}
                    href={t.href}
                    className={`${pill} ${isActive(t.href, t.key) ? on : off}`}
                    aria-current={isActive(t.href, t.key) ? "page" : undefined}
                  >
                    {t.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
