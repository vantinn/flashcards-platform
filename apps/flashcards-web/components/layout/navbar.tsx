import Link from "next/link";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import type { PublicUser } from "@/types/flashcard";

const publicLinks = [{ href: "/explore", label: "Explore" }];
const authedLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/sets", label: "My Sets" },
  { href: "/dashboard", label: "Dashboard" },
];

export interface NavbarProps {
  user?: PublicUser | null;
}

export function Navbar({ user = null }: NavbarProps) {
  // Signed-out visitors must not get /sets or /dashboard links: Next.js
  // prefetches visible <Link> hrefs automatically, proxy.ts 307s those
  // (unauthenticated) to /login, and the client Router Cache can then keep
  // reusing that cached redirect even right after the user logs in —
  // stranding them back on /login. Simplest fix is to never render (and
  // therefore never prefetch) a link the visitor isn't allowed to use yet.
  const links = user ? authedLinks : publicLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <MobileNav links={links} />
          <Link href="/" className="text-lg font-bold text-primary">
            Flashcards
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
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-card px-3 py-2 text-sm font-medium text-text-dark hover:bg-black/5"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-card bg-primary px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-primary-dark"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
