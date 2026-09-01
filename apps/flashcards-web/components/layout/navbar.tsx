import Link from "next/link";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { PublicUser } from "@/types/flashcard";

export interface NavbarProps {
  user?: PublicUser | null;
}

export async function Navbar({ user = null }: NavbarProps) {
  const dict = getDictionary(await getLocale());

  const publicLinks: { href: string; label: string }[] = [];
  const authedLinks = [
    { href: "/explore", label: dict.nav.explore },
    { href: "/sets", label: dict.nav.mySets },
    { href: "/dashboard", label: dict.nav.dashboard },
  ];

  // The whole app is authenticated-only, so signed-out visitors get no
  // application nav links at all — just Log in / Sign up. Beyond that being
  // the correct product behavior, it also avoids a real bug: Next.js
  // prefetches visible <Link> hrefs automatically, proxy.ts redirects those
  // (unauthenticated) to /login, and the client Router Cache can then keep
  // reusing that cached redirect even right after the user logs in —
  // stranding them back on /login. Never rendering (and therefore never
  // prefetching) a link the visitor isn't allowed to use yet avoids that.
  const links = user ? authedLinks : publicLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MobileNav links={links} />
          <Link href="/" className="text-lg font-bold text-primary">
            {dict.nav.brand}
          </Link>
        </div>
        <nav className="hidden items-center gap-6 text-sm font-medium text-text-dark sm:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-card px-3 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
              >
                {dict.nav.login}
              </Link>
              <Link
                href="/register"
                className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-primary-dark"
              >
                {dict.nav.signUp}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
