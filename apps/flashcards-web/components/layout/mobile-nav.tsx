"use client";

import Link from "next/link";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/lib/i18n/i18n-context";

export interface MobileNavProps {
  links: { href: string; label: string }[];
}

export function MobileNav({ links }: MobileNavProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-card text-text-dark hover:bg-black/5"
      >
        {open ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open ? (
        <nav className="absolute inset-x-0 top-16 z-30 border-b border-border bg-white shadow-card-lg">
          <ul className="flex flex-col p-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-card px-4 py-3 text-base font-medium text-text-dark hover:bg-black/5"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="px-4 py-3">
              <LanguageSwitcher />
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
