import Link from "next/link";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary, createTranslator, type Dictionary } from "@/lib/i18n/dictionary";

function footerColumns(dict: Dictionary) {
  return [
    {
      heading: dict.footer.product,
      links: [
        { href: "/sets/create", label: dict.footer.createSet },
        { href: "/explore", label: dict.footer.explorePublicSets },
        { href: "/sets", label: dict.footer.mySets },
      ],
    },
    {
      heading: dict.footer.learning,
      links: [
        { href: "/#learning-modes", label: dict.footer.studyModes },
        { href: "/#cram", label: dict.footer.cramMode },
        { href: "/#deep-learning", label: dict.footer.deepLearning },
      ],
    },
    {
      heading: dict.footer.account,
      links: [
        { href: "/login", label: dict.footer.login },
        { href: "/register", label: dict.footer.register },
        { href: "/profile", label: dict.footer.profile },
      ],
    },
  ];
}

export async function Footer() {
  const dict = getDictionary(await getLocale());
  const t = createTranslator(dict);
  const columns = footerColumns(dict);

  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
            <Link href="/" className="text-lg font-bold text-primary">
              {dict.nav.brand}
            </Link>
            <p className="text-sm text-text-muted">{dict.footer.tagline}</p>
          </div>
          {columns.map((column) => (
            <div key={column.heading} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-text-dark">{column.heading}</h3>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-text-muted hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="border-t border-border pt-6 text-sm text-text-muted">
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
