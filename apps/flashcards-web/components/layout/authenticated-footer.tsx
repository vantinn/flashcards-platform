import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

/**
 * Minimal footer for authenticated app pages. Only Privacy/Terms — the full
 * marketing footer (components/layout/footer.tsx) is reserved for
 * signed-out/public pages, where its extra links and columns make sense.
 */
export async function AuthenticatedFooter() {
  const dict = getDictionary(await getLocale());

  const links = [
    { href: "/privacy", label: dict.footer.privacy },
    { href: "/terms", label: dict.footer.terms },
  ];

  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <nav aria-label={dict.footer.legalNav} className="flex justify-center">
          <ul className="flex items-center gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="inline-block px-3 py-3 text-sm text-text-muted hover:text-primary hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
